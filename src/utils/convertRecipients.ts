// src/utils/convertRecipients.ts
export interface Address {
  name:  string;    
  email: string;        
}

export const toOption = (p: Address) => ({
  label: `${p.name} <${p.email}>`,
  value: p.email,
});
