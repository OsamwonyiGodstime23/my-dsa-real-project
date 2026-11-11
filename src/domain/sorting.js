import { DomainError } from "./errors.js";

export function mergeSort(items, compare) {
  if (!Array.isArray(items)) {
    throw new DomainError("Items must be an array", "VALIDATION");
  }
  if (typeof compare !== "function") {
    throw new DomainError("A comparison function is required", "VALIDATION");
  }

  let source = items.slice();
  let target = new Array(source.length);

  for (let width = 1; width < source.length; width *= 2) {
    for (let start = 0; start < source.length; start += width * 2) {
      const middle = Math.min(start + width, source.length);
      const end = Math.min(start + width * 2, source.length);
      let left = start;
      let right = middle;
      let output = start;

      while (left < middle && right < end) {
        const order = compare(source[left], source[right]);
        if (typeof order !== "number" || !Number.isFinite(order)) {
          throw new DomainError("Comparison function must return a finite number", "VALIDATION");
        }
        if (order <= 0) {
          target[output] = source[left];
          left += 1;
        } else {
          target[output] = source[right];
          right += 1;
        }
        output += 1;
      }
      while (left < middle) {
        target[output] = source[left];
        left += 1;
        output += 1;
      }
      while (right < end) {
        target[output] = source[right];
        right += 1;
        output += 1;
      }
    }

    [source, target] = [target, source];
  }

  return source;
}
