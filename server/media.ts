import {
  database,
  bucket,
  identity,
  checkOrigin,
  ApiError,
  failure,
} from "./core";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const user = await identity();
    const id = new URL(req.url).searchParams.get("id");
    const m = await database()
      .prepare(
        "SELECT m.id,m.type FROM media m WHERE m.id=? AND (m.user=? OR EXISTS(SELECT 1 FROM participations p JOIN community_tasks t ON t.id=p.task WHERE p.id=m.run AND t.owner=? AND p.status IN ('submitted','approved','rejected')))",
      )
      .bind(id, user, user)
      .first<{ id: string; type: string }>();
    if (!m) throw new ApiError(404, "附件不存在");
    const object = await bucket().get(m.id);
    if (!object) throw new ApiError(404, "附件不存在");
    return new Response(object.body, {
      headers: {
        "Content-Type": m.type,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const user = await identity();
    const length = Number(req.headers.get("content-length") || 0);
    if (length > 6 * 1024 * 1024) throw new ApiError(413, "附件不能超过 5 MB");
    const form = await req.formData();
    const file = form.get("file"),
      run = form.get("run");
    if (!(file instanceof File) || typeof run !== "string")
      throw new ApiError(400, "请选择一个文件");
    if (file.size > 5 * 1024 * 1024 || file.size === 0)
      throw new ApiError(413, "请选择 5 MB 以内的非空文件");
    const type = file.type.split(";")[0];
    if (
      ![
        "image/jpeg",
        "image/png",
        "image/webp",
        "audio/webm",
        "audio/mp4",
        "audio/ogg",
      ].includes(type)
    )
      throw new ApiError(400, "支持 JPG、PNG、WebP 图片或 WebM、MP4、Ogg 音频");
    const r = await database()
      .prepare(
        "SELECT id FROM runs WHERE id=? AND user=? AND status='active' AND deadline>? UNION ALL SELECT p.id FROM participations p JOIN community_tasks t ON t.id=p.task WHERE p.id=? AND p.user=? AND p.status IN ('joined','rejected') AND t.status<>'cancelled' AND t.deadline>?",
      )
      .bind(run, user, Date.now(), run, user, Date.now())
      .first();
    if (!r) throw new ApiError(409, "只能给进行中的任务添加附件");
    const count = await database()
      .prepare("SELECT count(*) AS count FROM media WHERE run=?")
      .bind(run)
      .first<{ count: number }>();
    if ((count?.count || 0) >= 6)
      throw new ApiError(409, "每个任务最多保存 6 个附件");
    const bytes = await file.arrayBuffer();
    const b = new Uint8Array(bytes);
    const valid =
      type === "image/png"
        ? b[0] === 137 && b[1] === 80
        : type === "image/jpeg"
          ? b[0] === 255 && b[1] === 216
          : type === "image/webp"
            ? String.fromCharCode(...b.slice(0, 4)) === "RIFF" &&
              String.fromCharCode(...b.slice(8, 12)) === "WEBP"
            : type === "audio/webm"
              ? b[0] === 26 && b[1] === 69
              : type === "audio/ogg"
                ? String.fromCharCode(...b.slice(0, 4)) === "OggS"
                : String.fromCharCode(...b.slice(4, 8)) === "ftyp";
    if (!valid) throw new ApiError(400, "文件内容与格式不匹配");
    const id = crypto.randomUUID();
    await bucket().put(id, bytes);
    try {
      await database()
        .prepare(
          "INSERT INTO media(id,user,run,type,size,created) VALUES(?,?,?,?,?,?)",
        )
        .bind(id, user, run, type, file.size, Date.now())
        .run();
    } catch (e) {
      await bucket().delete(id);
      throw e;
    }
    return Response.json({ id, run, type, size: file.size });
  } catch (e) {
    return failure(e);
  }
}
