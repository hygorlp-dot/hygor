export const digitsOnly = value => String(value ?? "").replace(/\D/g, "");

export function validateCPF(value) {
  const digits = digitsOnly(value);
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;

  const checkDigit = base => {
    let sum = 0;
    for (let index = 0; index < base; index += 1) {
      sum += Number(digits[index]) * (base + 1 - index);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return checkDigit(9) === Number(digits[9])
    && checkDigit(10) === Number(digits[10]);
}

export function validateCNPJ(value) {
  const digits = digitsOnly(value);
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return false;

  const checkDigit = base => {
    const weights = base === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let index = 0; index < base; index += 1) {
      sum += Number(digits[index]) * weights[index];
    }
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  return checkDigit(12) === Number(digits[12])
    && checkDigit(13) === Number(digits[13]);
}

export const validateBrazilianDocument = (document, personType) => (
  personType === "PF" ? validateCPF(document) : validateCNPJ(document)
);

export function formatCNPJ(value) {
  return digitsOnly(value).slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function formatCPF(value) {
  return digitsOnly(value).slice(0, 11)
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

export const formatBrazilianDocument = (value, personType) => (
  personType === "PF" ? formatCPF(value) : formatCNPJ(value)
);

export const formatCEP = value => digitsOnly(value)
  .slice(0, 8)
  .replace(/^(\d{5})(\d)/, "$1-$2");
