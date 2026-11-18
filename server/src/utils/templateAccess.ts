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
  isAdmin || template.user_id === userId || Number(template.is_public) === 1;

/** A tracked record may use a private template only if access was verified when it was saved. */
export const canUseTrackedTemplate = (
  template: TemplateAccessRecord,
  accessVerified: number | boolean | undefined,
): boolean => Number(template.is_public) === 1 || accessVerified === true || Number(accessVerified) === 1;
