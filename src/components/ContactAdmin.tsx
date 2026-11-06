'use client';

import { ADMIN_CONTACTS, formatNationalPhone, toWhatsAppDigits } from '@/lib/contacts';
import { Avatar } from './Avatar';
import { IconChat } from './icons';

export function ContactAdmin({ compact = false }: { compact?: boolean }) {
  return <div className={compact ? 'contact-list compact' : 'contact-list'}>
    {ADMIN_CONTACTS.map((contact) => <article className="contact-row" key={contact.phone}>
      <Avatar name={contact.name} src={null} />
      <div className="contact-info"><b>{contact.name}</b><span>{contact.title}</span><span className="num">{formatNationalPhone(contact.phone)}</span></div>
      <a className="btn ghost contact-chat" href={`https://wa.me/${toWhatsAppDigits(contact.phone)}`} target="_blank" rel="noopener noreferrer"
        aria-label={`Chat WhatsApp dengan ${contact.name}`}><IconChat size={18} /><span>Chat WhatsApp</span></a>
    </article>)}
  </div>;
}
