import { randomBytes, randomUUID } from "node:crypto";
import { DomainError } from "./errors.js";

const REFERENCE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const REFERENCE_LENGTH = 8;

export function newId() {
  return randomUUID();
}

export function newReference() {
  const bytes = randomBytes(REFERENCE_LENGTH);
  let reference = "";

  for (const byte of bytes) {
    reference += REFERENCE_ALPHABET[byte % REFERENCE_ALPHABET.length];
  }

  if (reference.length !== REFERENCE_LENGTH) {
    throw new DomainError("Could not generate a booking reference", "ID_GENERATION");
  }

  return reference;
}
