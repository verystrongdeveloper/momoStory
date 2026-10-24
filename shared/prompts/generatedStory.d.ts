export function prepareGeneratedStory(raw: string, names: string[], language?: string): string;
export function generateValidatedStory(options: {
  generate: (repair?: string) => Promise<string>;
  names: string[];
  language?: string;
}): Promise<string>;
