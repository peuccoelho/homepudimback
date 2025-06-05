export function sanitizeInput(str) {
  if (typeof str !== "string") return "";
  return str.replace(/[<>"'`\\;]/g, "");
}