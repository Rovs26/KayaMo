/**
 * Maintained Philippine support resources. Appended by safety.ts — not inlined
 * into a system prompt where a model can garble the numbers.
 */
export type PhSupportResource = {
  id: string;
  name: string;
  contact: string;
};

export const PH_SUPPORT_RESOURCES: readonly PhSupportResource[] = [
  { id: 'ncmh-crisis', name: 'NCMH Crisis Hotline', contact: '1553' },
  {
    id: 'hopeline',
    name: 'Hopeline Philippines',
    contact: '2919 (Globe/TM) or (02) 8804-4673',
  },
  {
    id: 'in-touch',
    name: 'In Touch Community Services',
    contact: '+63 2 8893 7603',
  },
];

export function formatPhSupportFooter(): string {
  const lines = PH_SUPPORT_RESOURCES.map(
    (resource) => `${resource.name}: ${resource.contact}`,
  );
  return `Philippine support: ${lines.join(' · ')}`;
}
