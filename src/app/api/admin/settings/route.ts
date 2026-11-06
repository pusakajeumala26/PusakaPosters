import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { assertSameOrigin, json, readJson, route } from '@/lib/http';
import { deadlineFromInput } from '@/lib/members';
import { settingsPatch } from '@/lib/validation';

export const runtime = 'nodejs';

export const PATCH = route(async (req: Request) => {
  assertSameOrigin(req);
  await requireAdmin();
  const patch = settingsPatch.parse(await readJson(req));

  await db.setting.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      ...(patch.letingName !== undefined ? { letingName: patch.letingName } : {}),
      ...(patch.target !== undefined ? { target: patch.target } : {}),
      ...(patch.uploadOpen !== undefined ? { uploadOpen: patch.uploadOpen } : {}),
      ...(patch.deadline ? { deadline: deadlineFromInput(patch.deadline) } : {}),
    },
    update: {
      ...(patch.letingName !== undefined ? { letingName: patch.letingName } : {}),
      ...(patch.target !== undefined ? { target: patch.target } : {}),
      ...(patch.uploadOpen !== undefined ? { uploadOpen: patch.uploadOpen } : {}),
      ...(patch.deadline !== undefined ? { deadline: patch.deadline ? deadlineFromInput(patch.deadline) : null } : {}),
    },
  });
  return json({ ok: true });
});
