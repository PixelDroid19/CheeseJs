import jc from 'json-cycle';
import ObjetToString from 'stringify-object';

export enum Colors {
  TRUE = '#1f924a',
  FALSE = '#f55442',
  NUMBER = '#368aa3',
  STRING = '#c3e88d',
  GRAY = '#807b7a',
  ERROR = '#ff0000',
}

export interface StringColoredElement {
  content: string;
  color?: Colors;
}

export interface RecursiveColoredElement {
  content: Array<StringColoredElement | RecursiveColoredElement>;
  color?: Colors;
}

export type ColoredElement = RecursiveColoredElement | StringColoredElement;

const isPromise = (
  promiseToCheck: unknown
): promiseToCheck is Promise<unknown> => {
  if (!promiseToCheck) return false;
  if (
    typeof promiseToCheck !== 'object' &&
    typeof promiseToCheck !== 'function'
  ) {
    return false;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return typeof (promiseToCheck as any).then === 'function';
};

export function flattenColoredElement(
  element: ColoredElement
): StringColoredElement[] {
  if (typeof element.content === 'string') {
    return [
      {
        content: element.content,
        color: element.color,
      },
    ];
  }

  return element.content
    .map((it) => {
      if (typeof it.content === 'string') return it as StringColoredElement;

      return (it as RecursiveColoredElement).content
        .map((recursive) => flattenColoredElement(recursive))
        .flat();
    })
    .flat();
}
// Helper to safely inspect global objects like Window without freezing
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatGlobalObject(obj: any, name: string): string {
  const props: string[] = [];

  // Get all properties (own and inherited) safely
  // We use a Set to avoid duplicates if we traverse prototype chain manually
  const keys = new Set<string>();

  // Add own keys
  try {
    Object.getOwnPropertyNames(obj).forEach((k) => keys.add(k));
  } catch {
    // Ignore access errors
  }

  // Add prototype keys (one level up is usually enough for Window/Document)
  try {
    const proto = Object.getPrototypeOf(obj);
    if (proto) {
      Object.getOwnPropertyNames(proto).forEach((k) => keys.add(k));
    }
  } catch {
    // Ignore access errors
  }

  // Convert to array and sort
  const sortedKeys = Array.from(keys).sort();

  for (const key of sortedKeys) {
    try {
      // Check descriptor first to identify getters/setters without triggering them
      let desc: PropertyDescriptor | undefined;
      try {
        desc =
          Object.getOwnPropertyDescriptor(obj, key) ||
          (Object.getPrototypeOf(obj)
            ? Object.getOwnPropertyDescriptor(Object.getPrototypeOf(obj), key)
            : undefined);
      } catch {
        // ignore
      }

      if (desc && (desc.get || desc.set)) {
        props.push(`  ${key}: [Getter/Setter]`);
        continue;
      }

      const value = obj[key];

      if (value === obj) {
        props.push(`  ${key}: [Circular]`);
      } else if (typeof value === 'function') {
        // Format: alert: ƒ alert()
        props.push(`  ${key}: ƒ ${value.name || key}()`);
      } else if (typeof value === 'object' && value !== null) {
        // Format: location: Location { ... } or just type
        const typeName = value.constructor?.name || 'Object';
        props.push(`  ${key}: [${typeName}]`);
      } else if (typeof value === 'string') {
        props.push(`  ${key}: "${value}"`);
      } else {
        props.push(`  ${key}: ${String(value)}`);
      }
    } catch {
      props.push(`  ${key}: [Restricted]`);
    }
  }

  return `<ref *1> ${name} {\n${props.join(',\n')}\n}`;
}

export async function stringify(element: unknown): Promise<ColoredElement> {
  // Prevent freezing when inspecting global objects
  if (typeof window !== 'undefined' && element === window) {
    return {
      content: formatGlobalObject(window, 'Window [global]'),
      color: Colors.GRAY,
    };
  }

  if (typeof document !== 'undefined' && element === document) {
    return {
      content: formatGlobalObject(document, 'Document'),
      color: Colors.GRAY,
    };
  }

  if (typeof globalThis !== 'undefined' && element === globalThis) {
    return {
      content: formatGlobalObject(globalThis, 'Global'),
      color: Colors.GRAY,
    };
  }

  if (Array.isArray(element)) {
    try {
      return {
        content: ObjetToString(jc.decycle(element), {
          indent: '  ',
          singleQuotes: false,
          inlineCharacterLimit: 80,
        }),
      };
    } catch {
      return {
        content: '[Array - unable to serialize]',
        color: Colors.GRAY,
      };
    }
  }

  if (isPromise(element)) {
    return {
      content: 'Promise { <pending> }',
      color: Colors.GRAY,
    };
  }

  if (element === true) {
    return {
      content: 'true',
      color: Colors.TRUE,
    };
  }

  if (element === false) {
    return {
      content: 'false',
      color: Colors.FALSE,
    };
  }

  if (typeof element === 'number') {
    return {
      content: element.toString(),
      color: Colors.NUMBER,
    };
  }

  if (typeof element === 'object') {
    try {
      return {
        content: ObjetToString(jc.decycle(element)),
        color: Colors.GRAY,
      };
    } catch {
      return {
        content: '[Object - unable to serialize]',
        color: Colors.GRAY,
      };
    }
  }

  if (typeof element === 'string') {
    return {
      content: `"${element}"`,
      color: Colors.STRING,
    };
  }

  if (typeof element === 'symbol') {
    return {
      content: [
        {
          content: 'Symbol(',
          color: Colors.GRAY,
        },
        await stringify(element.description),
        {
          content: ')',
          color: Colors.GRAY,
        },
      ],
    };
  }

  if (typeof element === 'bigint') {
    return {
      content: `${element}n`,
      color: Colors.NUMBER,
    };
  }

  if (element === undefined) {
    return {
      content: 'undefined',
      color: Colors.GRAY,
    };
  }

  if (element === null) {
    return {
      content: 'null',
      color: Colors.GRAY,
    };
  }

  return {
    content: element.toString(),
    color: Colors.GRAY,
  };
}
