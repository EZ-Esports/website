/**
 * Leadership business logic and role classification helpers.
 * Shared between CMS administration, seed/migration scripts, and public leadership pages.
 */

export interface RoleClassification {
  displayOrder: number;
  department: string;
}

/**
 * Classifies a leadership role into seniority tiers and canonical departments:
 * - Tier 1: Executive (President, Founder, CTO, VP, CEO)
 * - Tier 2: Directors / Leads (Broadcasting Director, Marketing Director, etc.)
 * - Tier 3: Associates / Staff / Engineers / Coordinators
 * - Tier 4: Advisors & Special Thanks
 */
export function classifyRole(role: string): RoleClassification {
  const lower = role.toLowerCase().trim();

  // 1. Executive (President, Founder, CTO, VP, CEO)
  if (
    lower === 'president' ||
    lower === 'founder' ||
    lower === 'cto' ||
    lower === 'ceo' ||
    lower === 'co-founder' ||
    lower.includes('vice president') ||
    lower.includes('executive')
  ) {
    return { displayOrder: 1, department: 'Executive' };
  }

  // 4. Advisors & Special Thanks
  if (
    lower.includes('advisor') ||
    lower.includes('special thanks') ||
    lower.includes('consultant')
  ) {
    return { displayOrder: 4, department: 'Advisors' };
  }

  // 2. Directors / Leads
  if (
    lower.includes('director') ||
    lower.includes('lead') ||
    lower.includes('head')
  ) {
    let dept = role
      .replace(/\b(Co-Director|Director|Co-Lead|Lead|Head)\b/gi, '')
      .trim();
    if (!dept) dept = 'Directors';
    return { displayOrder: 2, department: dept };
  }

  // 3. Associates / Staff / Engineers / Coordinators
  if (
    lower.includes('associate') ||
    lower.includes('staff') ||
    lower.includes('engineer') ||
    lower.includes('coordinator') ||
    lower.includes('manager')
  ) {
    let dept = role
      .replace(/\b(Associate|Staff|Software Engineer|Engineer|Coordinator|Manager)\b/gi, '')
      .trim();
    if (!dept) dept = 'Staff';
    return { displayOrder: 3, department: dept };
  }

  // Default: Associates / Staff
  return { displayOrder: 3, department: 'Staff' };
}
