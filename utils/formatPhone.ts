export function formatPhoneToDb(phone: string): string {
  // Remove formato de whatsapp, se existir
  if (phone.includes("@")) {
    phone = phone.split("@")[0];
  }

  // Remove apenas um prefixo 55 do início, se existir
  let clean = phone.replace(/^55/, "");

  // Se o número após o DDD tiver 8 dígitos, adiciona o 9 na frente
  if (/^\d{2}\d{8}$/.test(clean)) {
    clean = clean.slice(0, 2) + "9" + clean.slice(2);
  }
  // Formata para (XX) XXXXX-XXXX
  return clean.replace(/^(\d{2})(\d{5})(\d{4})$/, "($1) $2-$3");
}

export function formatPhone(phone: string) {
  // Remove DDI se existir
  const num = phone.startsWith("55") ? phone.slice(2) : phone;
  // DDD são os dois primeiros dígitos
  const ddd = num.slice(0, 2);
  const rest = num.slice(2);

  // Celular com 9 dígitos
  if (rest.length === 9) {
    return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  }

  // Celular com 8 dígitos
  if (rest.length === 8) {
    return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  }

  // Fallback
  return phone;
}

export function formatOnlyNumbers(phone: string) {
  let phoneParse = phone.replace(/\D/g, "");

  if (phoneParse.length == 10 || phoneParse.length == 11) {
    phoneParse = "55" + phoneParse;
  }
  return phoneParse;
}
