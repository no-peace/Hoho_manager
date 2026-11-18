export interface TemplateAccessRecord {
  user_id: number;
  is_public: number | boolean;
}

/** Private templates are visible only to their owner or a Head Admin. */
export const canAccessTemplate = (
  template: TemplateAccessRecord,
  userId: number | undefined,
  isAdmin: boolean,
): boolean =>
  isAdmin || template.user_id === userId || Boolean(template.is_public);
