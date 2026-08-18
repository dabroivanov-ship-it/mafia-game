export type InfoSection =
  | 'hub'
  | 'about'
  | 'rules'
  | 'roles'
  | 'aiAgents'
  | 'chatRules'
  | 'team'
  | 'rating'
  | 'quizLeaders'
  | 'faq';

export const INFO_PATHS: Record<InfoSection, string> = {
  hub: '/info',
  about: '/info/about',
  rules: '/info/rules',
  roles: '/info/roles',
  aiAgents: '/info/ai',
  chatRules: '/info/chat',
  team: '/info/team',
  rating: '/info/rating',
  quizLeaders: '/info/quiz',
  faq: '/info/faq',
};

export function infoSectionFromPath(path: string): InfoSection {
  const normalized = path.replace(/\/+$/, '') || '/';
  if (normalized.startsWith('/info/about')) return 'about';
  if (normalized.startsWith('/info/roles')) return 'roles';
  if (normalized.startsWith('/info/rules')) return 'rules';
  if (normalized.startsWith('/info/ai')) return 'aiAgents';
  if (normalized.startsWith('/info/chat')) return 'chatRules';
  if (normalized.startsWith('/info/team')) return 'team';
  if (normalized.startsWith('/info/rating')) return 'rating';
  if (normalized.startsWith('/info/quiz')) return 'quizLeaders';
  if (normalized.startsWith('/info/faq')) return 'faq';
  if (normalized === '/info') return 'hub';
  return 'hub';
}

export function isPublicInfoPath(path: string): boolean {
  const normalized = path.replace(/\/+$/, '') || '/';
  return normalized === '/info' || normalized.startsWith('/info/');
}

export function pathForInfoSection(section: InfoSection): string {
  return INFO_PATHS[section];
}
