import jc from 'json-cycle'
import ObjetToString from 'stringify-object'

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

const isPromise = (promiseToCheck: unknown): promiseToCheck is Promise<unknown> => {
  if (!promiseToCheck) return false
  if (typeof promiseToCheck !== 'object' && typeof promiseToCheck !== 'function') {
    return false
  }
  return typeof (promiseToCheck as any).then === 'function'
}

export function flattenColoredElement (
  element: ColoredElement
): StringColoredElement[] {
  if (typeof element.content === 'string') {
    return [
      {
        content: element.content,
        color: element.color
      }
    ]
  }

  return element.content
    .map((it) => {
      if (typeof it.content === 'string') return it as StringColoredElement

      return (it as RecursiveColoredElement).content
        .map((recursive) => flattenColoredElement(recursive))
        .flat()
    })
    .flat()
}
export async function stringify (element: unknown): Promise<ColoredElement> {
  if (Array.isArray(element)) {
    return {
      content: ObjetToString(jc.decycle(element), {
        indent: '  ',
        singleQuotes: false,
        inlineCharacterLimit: 20
      })
    }
  }

  if (isPromise(element)) {
    try {
      // Use Promise.resolve for reliable promise handling
      const resolvedValue = await Promise.resolve(element)
      
      // Check if the resolved value is a Response object
      const isResponseObject = resolvedValue && 
        typeof resolvedValue === 'object' &&
        'status' in resolvedValue &&
        'headers' in resolvedValue &&
        typeof (resolvedValue as any).text === 'function'

      if (isResponseObject) {
        return {
          content: `Response { status: ${(resolvedValue as any).status} }`,
          color: Colors.STRING
        }
      }

      return await stringify(resolvedValue)
    } catch (error) {
      // Handle rejected promises
      const errorMessage = error instanceof Error ? error.message : String(error)
      return {
        content: `Promise { <rejected>: ${errorMessage} }`,
        color: Colors.ERROR
      }
    }
  }

  if (element === true) {
    return {
      content: 'true',
      color: Colors.TRUE
    }
  }

  if (element === false) {
    return {
      content: 'false',
      color: Colors.FALSE
    }
  }

  if (typeof element === 'number') {
    return {
      content: element.toString(),
      color: Colors.NUMBER
    }
  }

  if (typeof element === 'object') {
    return {
      content: ObjetToString(jc.decycle(element)),
      color: Colors.GRAY
    }
  }

  if (typeof element === 'string') {
    return {
      content: `"${element}"`,
      color: Colors.STRING
    }
  }

  if (typeof element === 'symbol') {
    return {
      content: [
        {
          content: 'Symbol(',
          color: Colors.GRAY
        },
        await stringify(element.description),
        {
          content: ')',
          color: Colors.GRAY
        }
      ]
    }
  }

  if (typeof element === 'bigint') {
    return {
      content: `${element}n`,
      color: Colors.NUMBER
    }
  }

  if (element === undefined) {
    return {
      content: 'undefined',
      color: Colors.GRAY
    }
  }

  if (element === null) {
    return {
      content: 'null',
      color: Colors.GRAY
    }
  }

  return {
    content: element.toString(),
    color: Colors.GRAY
  }
}
