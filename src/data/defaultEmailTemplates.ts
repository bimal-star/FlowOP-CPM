import type { EmailTemplate } from '../types/crm'

type Seed = Pick<
  EmailTemplate,
  'name' | 'subject' | 'body' | 'category' | 'sort_order' | 'parent_id' | 'level'
>

export const DEFAULT_EMAIL_TEMPLATE_SEEDS: Seed[] = [
  {
    name: 'Initial Enquiry Acknowledgement',
    category: 'Enquiry',
    parent_id: null,
    level: 0,
    sort_order: 0,
    subject: 'Re: Your Enquiry - FlowOP Solutions',
    body: `Hi {{name}},

Thank you for contacting FlowOP Solutions regarding your enquiry.

Company on file: {{company}}

We have received your message and will review it shortly.

Best regards,
FlowOP Solutions`,
  },
  {
    name: 'Post Discovery Call Follow Up',
    category: 'Follow Up',
    parent_id: null,
    level: 0,
    sort_order: 1,
    subject: 'Following our discovery call — FlowOP Solutions',
    body: `Hi {{name}},

Thank you for taking the time for our discovery call today.

As discussed, your next step: {{next_action}}

If you have any questions before we speak again, reply to this email or contact us on {{email}}.

Kind regards,
FlowOP Solutions`,
  },
  {
    name: 'Scope of Work',
    category: 'Proposal',
    parent_id: null,
    level: 0,
    sort_order: 2,
    subject: 'Scope of work — FlowOP Solutions',
    body: `Hi {{name}},

Please find below an outline of the proposed scope of work for {{company}}.

Next action agreed: {{next_action}}

We look forward to your feedback.

Kind regards,
FlowOP Solutions`,
  },
  {
    name: 'Polite Decline',
    category: 'Decline',
    parent_id: null,
    level: 0,
    sort_order: 3,
    subject: 'Update on your enquiry — FlowOP Solutions',
    body: `Hi {{name}},

Thank you for your interest in FlowOP Solutions and for the time you invested in discussions with us.

After careful consideration, we will not be proceeding with a proposal at this time.

We wish you every success with {{company}} and your future projects.

Kind regards,
FlowOP Solutions`,
  },
  {
    name: 'Testimonial Request',
    category: 'Post Delivery',
    parent_id: null,
    level: 0,
    sort_order: 4,
    subject: "We'd love your feedback — FlowOP Solutions",
    body: `Hi {{name}},

We hope things are going well at {{company}}.

If you have a moment, we would really appreciate a short testimonial about your experience working with FlowOP Solutions — it helps others like you find us.

Thank you again for choosing us.

Kind regards,
FlowOP Solutions`,
  },
]
