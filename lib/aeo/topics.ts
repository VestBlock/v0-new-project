export type AeoTopic = {
  slug: string;
  title: string;
  language?: 'en' | 'es';
  cluster:
    | 'credit-repair'
    | 'business-credit'
    | 'funding'
    | 'credit-builder'
    | 'disputes';
  intent: 'education' | 'comparison' | 'lead-capture' | 'tool-support';
  offerPath: string;
  metaDescription: string;
  audience: string;
  overview: string;
  keyTakeaways: string[];
  actionSteps: string[];
  faqs: Array<{
    question: string;
    answer: string;
  }>;
};

export const clusterLabels: Record<AeoTopic['cluster'], string> = {
  'credit-repair': 'AI Credit Repair',
  'business-credit': 'Business Credit',
  funding: 'Funding Preparation',
  'credit-builder': 'Credit Builder Tools',
  disputes: 'Credit Disputes',
};

export const intentLabels: Record<AeoTopic['intent'], string> = {
  education: 'Learn',
  comparison: 'Compare',
  'lead-capture': 'Get Ready',
  'tool-support': 'Use A Tool',
};

export const vestblockAeoTopics: AeoTopic[] = [
  {
    slug: 'ai-credit-repair',
    title: 'AI Credit Repair',
    cluster: 'credit-repair',
    intent: 'lead-capture',
    offerPath: '/credit-upload',
    metaDescription:
      'Learn how AI credit repair support can organize report issues, dispute options, and next steps without making unrealistic credit promises.',
    audience: 'People who want a faster way to understand what is hurting their credit report.',
    overview:
      'AI credit repair support is most useful when it helps you read a report, spot possible inaccurate or unverifiable items, and organize the documents needed for a dispute. It should not promise a score jump or remove accurate information. VestBlock focuses on the practical side: upload, analysis, dispute-letter support, and next-step tracking.',
    keyTakeaways: [
      'AI can help summarize report problems, but you stay in control of what gets disputed.',
      'Good credit repair depends on documentation, accuracy, and follow-through.',
      'The safest tools explain options instead of guaranteeing deletions or scores.',
    ],
    actionSteps: [
      'Upload a current credit report before making a dispute plan.',
      'Review negative items for accuracy, dates, balances, ownership, and reporting consistency.',
      'Use dispute letters only when you have a clear reason and supporting details.',
    ],
    faqs: [
      {
        question: 'Can AI repair my credit automatically?',
        answer:
          'AI can help organize and draft your credit repair work, but credit bureaus and furnishers decide how disputes are handled. You should review every letter and claim before sending anything.',
      },
      {
        question: 'What should I upload first?',
        answer:
          'Start with a recent credit report that includes account history, collections, inquiries, balances, and bureau details.',
      },
    ],
  },
  {
    slug: 'credit-dispute-letters',
    title: 'Credit Dispute Letters',
    cluster: 'disputes',
    intent: 'tool-support',
    offerPath: '/tools/my-dispute-letters',
    metaDescription:
      'Understand when credit dispute letters are useful, what they should include, and how VestBlock helps organize letter drafting.',
    audience: 'Consumers preparing to challenge inaccurate or unverifiable report items.',
    overview:
      'A credit dispute letter should be specific, factual, and tied to a real concern on your report. Strong letters usually identify the account, explain the issue, request investigation, and include supporting documents when available. VestBlock helps turn report analysis into organized dispute-letter drafts.',
    keyTakeaways: [
      'A vague dispute is easier to ignore than a documented, specific one.',
      'Each letter should match the issue: collection, charge-off, late payment, inquiry, or identity concern.',
      'Keep copies of letters, reports, documents, and bureau responses.',
    ],
    actionSteps: [
      'Identify the exact account or item you want reviewed.',
      'Write the dispute reason in plain, accurate language.',
      'Attach documents that support your position when you have them.',
    ],
    faqs: [
      {
        question: 'Do dispute letters need legal language?',
        answer:
          'No. Clear, factual language is usually better than complicated wording. The key is explaining what is wrong and what you want investigated.',
      },
      {
        question: 'Can VestBlock generate a letter for me?',
        answer:
          'VestBlock can help draft letters from your report analysis, but you should review and approve every letter before using it.',
      },
    ],
  },
  {
    slug: '609-letters',
    title: '609 Letters',
    cluster: 'disputes',
    intent: 'education',
    offerPath: '/super-dispute',
    metaDescription:
      'Learn what 609 letters are commonly used for, what they can and cannot do, and how to avoid credit repair myths.',
    audience: 'People researching 609 letters before sending a dispute.',
    overview:
      'A 609 letter is commonly discussed as a way to request verification of information on a credit report. It is not a magic deletion letter. A better approach is to use the rights behind credit reporting law responsibly: ask for investigation, be specific, and avoid claims you cannot support.',
    keyTakeaways: [
      '609 letters are often oversold online.',
      'A request for verification should still identify a real reporting concern.',
      'No letter format can guarantee a deletion.',
    ],
    actionSteps: [
      'Check whether the item is inaccurate, outdated, duplicated, or unverifiable.',
      'Collect report pages and documents before drafting.',
      'Keep the request focused on investigation and verification.',
    ],
    faqs: [
      {
        question: 'Will a 609 letter remove negative accounts?',
        answer:
          'Not by itself. A bureau may update, verify, or remove information depending on its investigation and the furnisher response.',
      },
      {
        question: 'Is a 609 letter the same as a dispute letter?',
        answer:
          'It is usually used as a type of verification request. In practice, the strongest letters are still clear, factual disputes.',
      },
    ],
  },
  {
    slug: 'method-of-verification',
    title: 'Method Of Verification',
    cluster: 'disputes',
    intent: 'education',
    offerPath: '/super-dispute',
    metaDescription:
      'Learn how method-of-verification requests fit into credit disputes and what information to track after a bureau response.',
    audience: 'Consumers following up after a credit bureau verifies disputed information.',
    overview:
      'A method-of-verification request asks how a bureau verified information after a dispute. It can help you understand the investigation trail, but it is not a shortcut around documentation. Use it when you need a clearer record of what was checked and who supplied the information.',
    keyTakeaways: [
      'This is usually a follow-up step after a dispute result.',
      'It works best when you track dates, bureaus, account names, and response letters.',
      'It should support a bigger documentation strategy.',
    ],
    actionSteps: [
      'Save the bureau response that verified the item.',
      'Request the verification method for the specific account or item.',
      'Compare the response with your documents and report details.',
    ],
    faqs: [
      {
        question: 'When should I request method of verification?',
        answer:
          'Usually after a bureau verifies an item and you want to understand how that decision was reached.',
      },
      {
        question: 'Does method of verification force deletion?',
        answer:
          'No. It can provide useful information, but deletion depends on whether the reporting can be verified and is accurate.',
      },
    ],
  },
  {
    slug: 'charge-off-disputes',
    title: 'Charge-Off Disputes',
    cluster: 'disputes',
    intent: 'tool-support',
    offerPath: '/credit-upload',
    metaDescription:
      'Review charge-off dispute basics, common reporting issues, and how to organize a careful dispute plan.',
    audience: 'Consumers reviewing charged-off accounts on a credit report.',
    overview:
      'A charge-off can affect credit for years, so disputes should be handled carefully. The goal is not to deny accurate debt. The goal is to check whether the reporting is accurate, complete, timely, and consistent across bureaus.',
    keyTakeaways: [
      'Charge-off status, balance, dates, and ownership should be reviewed closely.',
      'Disputing accurate debt without a reason can waste time.',
      'Documentation matters more than aggressive wording.',
    ],
    actionSteps: [
      'Compare charge-off details across all bureaus.',
      'Look for incorrect balances, duplicate collections, or date errors.',
      'Prepare a focused letter for each bureau or furnisher issue.',
    ],
    faqs: [
      {
        question: 'Can I dispute a charge-off?',
        answer:
          'Yes, if you believe information is inaccurate, incomplete, outdated, duplicated, or unverifiable.',
      },
      {
        question: 'Should I dispute every charge-off?',
        answer:
          'Not automatically. Review each account and choose disputes based on specific reporting concerns.',
      },
    ],
  },
  {
    slug: 'collection-disputes',
    title: 'Collection Disputes',
    cluster: 'disputes',
    intent: 'tool-support',
    offerPath: '/credit-upload',
    metaDescription:
      'Learn how collection disputes work and what to check before challenging a collection account.',
    audience: 'People with collection accounts who want a cleaner dispute plan.',
    overview:
      'Collection disputes often involve ownership, dates, balances, duplicate reporting, or whether the collector can validate the debt. A good plan separates credit bureau disputes from debt validation requests and keeps records of every response.',
    keyTakeaways: [
      'Credit bureau disputes and debt validation requests are related but different.',
      'Collection balances and dates often need careful review.',
      'A dispute should be based on a specific issue, not just the presence of a collection.',
    ],
    actionSteps: [
      'Identify the collector, original creditor, balance, and open date.',
      'Check whether the same debt appears more than once.',
      'Use the right letter type for bureau reporting or collector validation.',
    ],
    faqs: [
      {
        question: 'What is the first step with a collection account?',
        answer:
          'Confirm who is reporting it, what debt it claims to represent, and whether the details match your records.',
      },
      {
        question: 'Can a paid collection still appear?',
        answer:
          'Often yes, but it should report accurately. If the status or balance is wrong, that may be dispute-worthy.',
      },
    ],
  },
  {
    slug: 'business-credit',
    title: 'Business Credit',
    cluster: 'business-credit',
    intent: 'lead-capture',
    offerPath: '/tools/business-credit',
    metaDescription:
      'Learn how business credit works, what lenders look for, and how to prepare your company profile for funding opportunities.',
    audience: 'Business owners preparing for vendor accounts, cards, or funding.',
    overview:
      'Business credit is built through company identity, trade relationships, payment history, and lender-ready documentation. Before chasing funding, make sure your business profile is consistent and your credit/funding story is easy to verify.',
    keyTakeaways: [
      'Business identity consistency matters: name, address, phone, EIN, and web presence.',
      'Vendor accounts and payment history can support business credit growth.',
      'Personal credit may still matter for many early-stage funding products.',
    ],
    actionSteps: [
      'Check business registration, address, phone, and online listings.',
      'Organize revenue, bank statements, and entity documents.',
      'Review which funding or credit products match your current stage.',
    ],
    faqs: [
      {
        question: 'Can I build business credit without perfect personal credit?',
        answer:
          'Sometimes, but many products still consider personal credit, especially for newer businesses. Preparation improves your options.',
      },
      {
        question: 'What should I fix before applying?',
        answer:
          'Start with business identity consistency, documentation, revenue clarity, and any personal credit issues that could affect approval.',
      },
    ],
  },
  {
    slug: 'ein-business-credit',
    title: 'EIN Business Credit',
    cluster: 'business-credit',
    intent: 'education',
    offerPath: '/tools/business-credit',
    metaDescription:
      'Understand what EIN business credit means, where it helps, and why EIN-only funding claims should be treated carefully.',
    audience: 'Business owners researching EIN-only credit claims.',
    overview:
      'An EIN helps identify your business, but it does not automatically replace personal credit or guarantee approvals. EIN business credit works best when your business is properly set up, consistent across records, and building real payment history.',
    keyTakeaways: [
      'An EIN is an identifier, not instant business credit.',
      'Some accounts may report to business bureaus, while others do not.',
      'Be cautious with offers promising easy EIN-only approvals.',
    ],
    actionSteps: [
      'Confirm your entity and EIN records match your public business profile.',
      'Choose vendor or credit accounts that fit your stage.',
      'Track which accounts report and whether payments post accurately.',
    ],
    faqs: [
      {
        question: 'Does an EIN hide personal credit?',
        answer:
          'No. Many lenders can still ask for personal credit, a personal guarantee, or owner information.',
      },
      {
        question: 'How do I start building EIN business credit?',
        answer:
          'Set up a consistent business profile, open appropriate accounts, pay on time, and monitor reporting.',
      },
    ],
  },
  {
    slug: 'funding-readiness',
    title: 'Funding Preparation',
    cluster: 'funding',
    intent: 'lead-capture',
    offerPath: '/funding',
    metaDescription:
      'Prepare for business funding by reviewing credit, revenue, documentation, and lender-fit before applying.',
    audience: 'Business owners trying to improve approval odds before funding applications.',
    overview:
      'Funding preparation is the work you do before applying. It includes reviewing credit, business identity, bank activity, revenue, documents, and the type of funding that actually fits your situation.',
    keyTakeaways: [
      'A clean application starts before the application form.',
      'Lender-fit matters as much as raw revenue or credit score.',
      'Missing documents can slow down or weaken an otherwise promising file.',
    ],
    actionSteps: [
      'Review personal and business credit before applying.',
      'Organize bank statements, tax documents, entity records, and revenue details.',
      'Match the funding product to your stage, use case, and repayment ability.',
    ],
    faqs: [
      {
        question: 'What makes a business prepared for funding?',
        answer:
          'Consistent business records, clear revenue, organized documents, and a funding product that matches the business profile.',
      },
      {
        question: 'Should I apply before fixing credit issues?',
        answer:
          'It depends on the product, but reviewing credit first can help you avoid avoidable denials or poor terms.',
      },
    ],
  },
  {
    slug: 'business-setup-for-funding',
    title: 'Business Setup For Funding',
    cluster: 'funding',
    intent: 'lead-capture',
    offerPath: '/business-setup',
    metaDescription:
      'Use a business setup checklist to prepare entity records, banking, documents, credit, and grant requirements before applying for funding.',
    audience: 'Business owners who want a cleaner funding file before they apply.',
    overview:
      'Business setup for funding is the preparation work that makes an application easier to review. It connects entity records, EIN details, banking, bookkeeping, licenses, documents, credit, and use-of-funds planning into one organized file.',
    keyTakeaways: [
      'A lender-ready business starts with consistent identity and clean documents.',
      'Banking and bookkeeping should show how the business earns and uses money.',
      'Grant and funding applications work better when the use of funds is specific.',
    ],
    actionSteps: [
      'Confirm business entity, EIN, address, phone, and online listings match.',
      'Organize bank statements, revenue records, licenses, tax documents, and ownership details.',
      'Review business credit, personal credit exposure, and funding product fit before applying.',
    ],
    faqs: [
      {
        question: 'What documents should I prepare before business funding?',
        answer:
          'Common documents include entity records, EIN details, bank statements, tax records, licenses, ownership details, invoices, contracts, and a clear use-of-funds explanation.',
      },
      {
        question: 'Does setup guarantee approval?',
        answer:
          'No. Setup does not guarantee funding, but it can reduce avoidable delays and help you apply with clearer information.',
      },
    ],
  },
  {
    slug: 'financiamiento-para-negocios-en-espanol',
    title: 'Financiamiento Para Negocios En Espanol',
    language: 'es',
    cluster: 'funding',
    intent: 'lead-capture',
    offerPath: '/es/vestblock',
    metaDescription:
      'Prepara tu negocio para financiamiento en espanol con VestBlock y conecta con la ruta de Bank Breezy para duenos de negocio.',
    audience: 'Duenos de negocio que hablan espanol y buscan opciones de financiamiento.',
    overview:
      'Antes de aplicar para financiamiento, un dueno de negocio necesita organizar identidad, EIN, cuenta bancaria, documentos, ingresos y uso de fondos. VestBlock ayuda a preparar esos pasos y conecta con la pagina en espanol de Bank Breezy.',
    keyTakeaways: [
      'La preparacion ayuda a evitar aplicaciones incompletas.',
      'El credito personal, credito comercial e ingresos pueden afectar las opciones.',
      'Ninguna herramienta responsable debe prometer aprobaciones garantizadas.',
    ],
    actionSteps: [
      'Organiza documentos legales, EIN, direccion, telefono y cuenta bancaria comercial.',
      'Prepara estados bancarios, ingresos y explicacion del uso de fondos.',
      'Revisa opciones en la ruta en espanol de Bank Breezy cuando tengas la informacion lista.',
    ],
    faqs: [
      {
        question: 'VestBlock ofrece financiamiento garantizado?',
        answer:
          'No. VestBlock ayuda con preparacion y orientacion, pero cada banco, programa o socio revisa sus propios requisitos.',
      },
      {
        question: 'Donde esta la pagina en espanol de Bank Breezy?',
        answer:
          'VestBlock enlaza a Bankbreezy.com/es/Vestblock para que duenos de negocio puedan revisar opciones en espanol.',
      },
    ],
  },
  {
    slug: 'requisitos-para-financiamiento-comercial',
    title: 'Requisitos Para Financiamiento Comercial',
    language: 'es',
    cluster: 'funding',
    intent: 'education',
    offerPath: '/es/vestblock',
    metaDescription:
      'Conoce los requisitos mas comunes para financiamiento comercial y que debes preparar antes de aplicar.',
    audience:
      'Duenos de negocio que quieren entender que documentos y senales revisan los bancos o socios financieros.',
    overview:
      'Los requisitos para financiamiento comercial suelen incluir identidad del negocio, EIN, cuenta bancaria comercial, ingresos verificables, tiempo operando y una razon clara para usar los fondos. Preparar estos puntos antes de aplicar puede ayudar a evitar retrasos y aplicaciones debiles.',
    keyTakeaways: [
      'Los bancos y socios quieren informacion clara, coherente y documentable.',
      'El credito personal todavia puede influir, especialmente en negocios nuevos.',
      'Aplicar sin documentos listos puede crear friccion innecesaria.',
    ],
    actionSteps: [
      'Confirma que nombre legal, direccion, telefono y EIN coincidan en todos tus registros.',
      'Organiza estados bancarios, prueba de ingresos y documentos de la entidad.',
      'Define cuanto capital necesitas y como lo usara el negocio.',
    ],
    faqs: [
      {
        question: 'Que piden normalmente para financiamiento comercial?',
        answer:
          'Con frecuencia piden informacion de la entidad, EIN, estados bancarios, detalles de ingresos, informacion del propietario y el uso esperado de los fondos.',
      },
      {
        question: 'Si mi negocio es nuevo, todavia puedo aplicar?',
        answer:
          'Puede haber opciones, pero un negocio nuevo normalmente necesita expectativas mas realistas, mejor preparacion y una ruta de financiamiento bien elegida.',
      },
    ],
  },
  {
    slug: 'credito-comercial-para-negocios',
    title: 'Credito Comercial Para Negocios',
    language: 'es',
    cluster: 'business-credit',
    intent: 'lead-capture',
    offerPath: '/es/vestblock',
    metaDescription:
      'Aprende como funciona el credito comercial para negocios y que debes organizar antes de buscar lineas o tarjetas.',
    audience:
      'Duenos de negocio que quieren crear un perfil comercial mas fuerte antes de buscar financiamiento.',
    overview:
      'El credito comercial para negocios funciona mejor cuando la empresa tiene una identidad consistente, cuentas separadas, historial de pagos y documentos faciles de revisar. No se trata solo de abrir cuentas; se trata de construir un perfil creible y util para futuras decisiones de financiamiento.',
    keyTakeaways: [
      'La consistencia del negocio importa tanto como la solicitud.',
      'Un EIN no reemplaza automaticamente el credito personal.',
      'El historial de pagos y la documentacion ayudan a fortalecer el perfil comercial.',
    ],
    actionSteps: [
      'Verifica que la entidad, EIN, direccion y telefono del negocio esten actualizados.',
      'Separa las finanzas del negocio de las finanzas personales.',
      'Usa VestBlock para revisar si debes construir credito primero o preparar financiamiento.',
    ],
    faqs: [
      {
        question: 'Que es credito comercial para negocios?',
        answer:
          'Es el perfil de credito asociado al negocio y puede apoyarse en cuentas comerciales, historial de pagos, registros de la empresa y documentacion consistente.',
      },
      {
        question: 'Necesito credito personal para empezar?',
        answer:
          'Muchas veces si influye, sobre todo en etapas tempranas, aunque depende del producto y del perfil del negocio.',
      },
    ],
  },
  {
    slug: 'documentos-para-solicitar-financiamiento',
    title: 'Documentos Para Solicitar Financiamiento',
    language: 'es',
    cluster: 'funding',
    intent: 'tool-support',
    offerPath: '/es/vestblock',
    metaDescription:
      'Revisa los documentos que normalmente conviene preparar antes de solicitar financiamiento para tu negocio.',
    audience:
      'Duenos de negocio que quieren evitar aplicaciones incompletas y preparar un archivo mas limpio.',
    overview:
      'Tener los documentos correctos listos antes de solicitar financiamiento hace que el proceso sea mas claro para ti y para quien revisa la solicitud. La meta no es llenar papeles por llenar, sino respaldar la historia del negocio con informacion facil de verificar.',
    keyTakeaways: [
      'Los estados bancarios y la informacion de ingresos suelen ser piezas centrales.',
      'La identidad legal del negocio debe coincidir en todos los documentos.',
      'Una explicacion clara del uso de fondos puede fortalecer la solicitud.',
    ],
    actionSteps: [
      'Junta formacion de la entidad, EIN y documentos de propiedad si aplican.',
      'Organiza estados bancarios recientes y cualquier prueba de ingresos relevante.',
      'Prepara una explicacion simple de como el negocio usara el capital.',
    ],
    faqs: [
      {
        question: 'Que documentos debo tener listos primero?',
        answer:
          'Empieza con documentos de la entidad, EIN, estados bancarios, detalles de ingresos, identificacion del propietario y una explicacion del uso de fondos.',
      },
      {
        question: 'Puedo aplicar si todavia me faltan algunos papeles?',
        answer:
          'A veces si, pero normalmente es mejor organizar lo principal primero para evitar retrasos o preguntas innecesarias.',
      },
    ],
  },
  {
    slug: 'como-mejorar-la-elegibilidad-para-financiamiento',
    title: 'Como Mejorar La Elegibilidad Para Financiamiento',
    language: 'es',
    cluster: 'funding',
    intent: 'lead-capture',
    offerPath: '/es/vestblock',
    metaDescription:
      'Aprende pasos practicos para mejorar tu elegibilidad antes de solicitar financiamiento comercial.',
    audience:
      'Duenos de negocio que quieren fortalecer credito, documentos e ingresos antes de aplicar.',
    overview:
      'Mejorar la elegibilidad para financiamiento no significa inventar informacion; significa reducir debilidades reales antes de enviar mas solicitudes. VestBlock enfoca ese trabajo en credito, utilizacion, documentos, ingresos y consistencia del negocio.',
    keyTakeaways: [
      'Bajar utilizacion y evitar demasiadas consultas recientes puede ayudar.',
      'Los documentos claros reducen friccion y preguntas durante la revision.',
      'A veces la mejor jugada es preparar primero, no aplicar hoy.',
    ],
    actionSteps: [
      'Revisa si la utilizacion personal esta demasiado alta antes de solicitar nuevas cuentas.',
      'Organiza ingresos, estados bancarios y registros de la empresa.',
      'Evalua si necesitas una ruta de preparacion antes de buscar financiamiento.',
    ],
    faqs: [
      {
        question: 'Cual es la forma mas rapida de mejorar elegibilidad?',
        answer:
          'Depende del perfil, pero con frecuencia ayuda reducir utilizacion, aclarar documentos y evitar solicitudes innecesarias mientras preparas mejor el archivo.',
      },
      {
        question: 'VestBlock me dice si debo aplicar ahora o despues?',
        answer:
          'Si. VestBlock puede ayudarte a comparar una ruta de aplicar ahora frente a una ruta de preparacion primero.',
      },
    ],
  },
  {
    slug: 'lineas-de-credito-comercial',
    title: 'Lineas De Credito Comercial',
    language: 'es',
    cluster: 'funding',
    intent: 'comparison',
    offerPath: '/es/vestblock',
    metaDescription:
      'Compara de forma segura que revisar antes de buscar lineas de credito comercial para capital de trabajo.',
    audience:
      'Duenos de negocio que investigan lineas de credito comercial y quieren entender riesgos y preparacion.',
    overview:
      'Las lineas de credito comercial pueden ser utiles para capital de trabajo, pero no todas son iguales. Antes de solicitarlas, conviene revisar costos, pagos, requisitos, consultas y si el negocio puede manejar la deuda sin presion excesiva.',
    keyTakeaways: [
      'No toda linea de credito es adecuada para cada etapa del negocio.',
      'El costo total y el calendario de pagos importan tanto como el limite.',
      'La preparacion correcta ayuda a comparar mejor las opciones disponibles.',
    ],
    actionSteps: [
      'Aclara para que necesita capital el negocio y como planea devolverlo.',
      'Compara credito, ingresos, tiempo en negocio y documentos disponibles.',
      'Revisa opciones solo cuando el negocio este listo para sostener el pago.',
    ],
    faqs: [
      {
        question: 'Una linea de credito comercial es mejor que una tarjeta?',
        answer:
          'Depende del uso de fondos, costos, plazos y del perfil del negocio. Lo importante es escoger una opcion coherente con tu capacidad real de pago.',
      },
      {
        question: 'VestBlock garantiza lineas de credito?',
        answer:
          'No. VestBlock ayuda con preparacion, comparacion y estrategia, pero las decisiones finales son del emisor o socio financiero.',
      },
    ],
  },
  {
    slug: 'subvenciones-para-pequenos-negocios-en-espanol',
    title: 'Subvenciones Para Pequenos Negocios En Espanol',
    language: 'es',
    cluster: 'funding',
    intent: 'education',
    offerPath: '/es/vestblock',
    metaDescription:
      'Entiende como prepararte para subvenciones de pequenos negocios y que informacion conviene tener lista antes de aplicar.',
    audience:
      'Duenos de negocio que hablan espanol y quieren buscar subvenciones con un enfoque mas organizado.',
    overview:
      'Las subvenciones para pequenos negocios pueden ser utiles, pero suelen ser competitivas y requieren elegibilidad clara. Una mejor estrategia es preparar primero el perfil del negocio, la historia de la empresa y el uso especifico de fondos antes de llenar muchas solicitudes.',
    keyTakeaways: [
      'La mayoria de las subvenciones tienen reglas especificas de elegibilidad.',
      'La calidad de la aplicacion importa mas que la cantidad de formularios enviados.',
      'Un resumen claro del negocio y del uso de fondos fortalece la presentacion.',
    ],
    actionSteps: [
      'Define industria, ubicacion y perfil del negocio antes de buscar oportunidades.',
      'Prepara una descripcion breve del negocio y del uso esperado de los fondos.',
      'Usa VestBlock para organizar una ruta de preparacion antes de aplicar.',
    ],
    faqs: [
      {
        question: 'Las subvenciones son dinero facil?',
        answer:
          'Normalmente no. Suelen ser competitivas y requieren una buena coincidencia entre el negocio y los criterios del programa.',
      },
      {
        question: 'Que debo tener listo antes de aplicar a una subvencion?',
        answer:
          'Una historia clara del negocio, informacion de elegibilidad, documentos basicos y una explicacion especifica de como se usaran los fondos.',
      },
    ],
  },
  {
    slug: 'grants-for-small-businesses',
    title: 'Grants For Small Businesses',
    cluster: 'funding',
    intent: 'education',
    offerPath: '/tools/grants',
    metaDescription:
      'Learn how small business grants work, what to prepare, and why grant searches should be treated as a documentation process.',
    audience: 'Small business owners looking for realistic grant opportunities.',
    overview:
      'Small business grants are competitive and usually tied to eligibility, location, industry, purpose, or community impact. Strong applications depend on fit, documentation, and a clear use of funds.',
    keyTakeaways: [
      'Most grants are not general free money for any business.',
      'Eligibility and application quality matter more than volume.',
      'A good grant search should connect opportunities to your business profile.',
    ],
    actionSteps: [
      'Clarify your business type, location, ownership, and funding purpose.',
      'Prepare a short business summary and use-of-funds statement.',
      'Track deadlines, documents, and follow-up requirements.',
    ],
    faqs: [
      {
        question: 'Are small business grants easy to get?',
        answer:
          'Usually no. They can be valuable, but they are competitive and often have strict eligibility rules.',
      },
      {
        question: 'What should I prepare before applying?',
        answer:
          'Business documents, a concise story, financial details, eligibility proof, and a specific use of funds.',
      },
    ],
  },
  {
    slug: 'credit-builder-tools',
    title: 'Credit Builder Tools',
    cluster: 'credit-builder',
    intent: 'comparison',
    offerPath: '/dashboard',
    metaDescription:
      'Compare common credit builder tools and learn how they fit into a broader credit improvement plan.',
    audience: 'People looking for safer ways to build positive credit history.',
    overview:
      'Credit builder tools can help when they add positive payment history, lower utilization, or improve account mix. They are not a substitute for fixing inaccurate report issues or managing debt, but they can support a broader plan.',
    keyTakeaways: [
      'The right tool depends on your current report, cash flow, and goals.',
      'On-time payments and low utilization are still the basics.',
      'Fees and reporting details should be reviewed before signing up.',
    ],
    actionSteps: [
      'Review your report to see what is missing or hurting your profile.',
      'Compare fees, reporting bureaus, and payment requirements.',
      'Track whether the account reports correctly over time.',
    ],
    faqs: [
      {
        question: 'Do credit builder tools always help?',
        answer:
          'No. They help only when they fit your profile and are managed correctly.',
      },
      {
        question: 'What should I compare first?',
        answer:
          'Look at cost, bureau reporting, payment schedule, utilization impact, and cancellation terms.',
      },
    ],
  },
  {
    slug: 'secured-credit-cards',
    title: 'Secured Credit Cards',
    cluster: 'credit-builder',
    intent: 'comparison',
    offerPath: '/dashboard',
    metaDescription:
      'Learn how secured credit cards work, what to compare, and how to use them without hurting utilization.',
    audience: 'People rebuilding or starting credit with a deposit-backed card.',
    overview:
      'A secured credit card uses a deposit to reduce lender risk. It can help build payment history if it reports to the bureaus and is used carefully. The main risk is carrying high utilization or missing payments.',
    keyTakeaways: [
      'Confirm the card reports to major credit bureaus.',
      'Keep balances low compared with the limit.',
      'Review fees and graduation options before applying.',
    ],
    actionSteps: [
      'Compare annual fees, deposit requirements, and bureau reporting.',
      'Use the card for small recurring purchases.',
      'Pay on time and keep utilization low.',
    ],
    faqs: [
      {
        question: 'How much should I use on a secured card?',
        answer:
          'Many people aim to keep utilization low and pay the card on time every month.',
      },
      {
        question: 'Can a secured card become unsecured?',
        answer:
          'Some issuers offer graduation reviews, but policies vary by card issuer.',
      },
    ],
  },
  {
    slug: 'rent-reporting',
    title: 'Rent Reporting',
    cluster: 'credit-builder',
    intent: 'comparison',
    offerPath: '/dashboard',
    metaDescription:
      'Understand rent reporting services, when they may help, and what to check before using one.',
    audience: 'Renters considering adding rental payment history to their credit profile.',
    overview:
      'Rent reporting services may add rental payment history to one or more credit bureaus. They can be useful for people with thin files, but results depend on which bureaus receive the data and how the rest of the credit profile looks.',
    keyTakeaways: [
      'Not every rent reporting service reports to every bureau.',
      'Positive rent history may help thin credit files more than already complex profiles.',
      'Fees and landlord verification requirements vary.',
    ],
    actionSteps: [
      'Confirm which bureaus the service reports to.',
      'Check setup fees, monthly fees, and cancellation policies.',
      'Monitor your report after enrollment.',
    ],
    faqs: [
      {
        question: 'Does rent reporting improve every credit score?',
        answer:
          'Not always. It depends on the scoring model, bureau, and your full credit profile.',
      },
      {
        question: 'Do I need landlord approval?',
        answer:
          'Some services require landlord or payment verification, while others use bank transaction data.',
      },
    ],
  },
  {
    slug: 'tradelines-education',
    title: 'Tradelines Education',
    cluster: 'credit-builder',
    intent: 'education',
    offerPath: '/dashboard',
    metaDescription:
      'Learn what tradelines are, how they affect credit reports, and why risky tradeline claims deserve caution.',
    audience: 'People trying to understand tradelines before making credit decisions.',
    overview:
      'A tradeline is simply an account listed on a credit report. Credit cards, loans, and other reported accounts can all be tradelines. Be careful with paid tradeline schemes or claims that promise guaranteed score changes.',
    keyTakeaways: [
      'Tradeline quality depends on payment history, age, utilization, and account type.',
      'Buying access to someone else\'s account can carry risk.',
      'Building your own positive history is more durable than shortcuts.',
    ],
    actionSteps: [
      'Review existing tradelines for accuracy and utilization.',
      'Focus on on-time payments and low balances.',
      'Avoid guarantees around purchased tradelines.',
    ],
    faqs: [
      {
        question: 'Is every account a tradeline?',
        answer:
          'Every reported account is commonly called a tradeline, but not every bill or payment reports to credit bureaus.',
      },
      {
        question: 'Are paid tradelines safe?',
        answer:
          'They can be risky and may not produce the promised outcome. Review the legal, lender, and practical risks before considering them.',
      },
    ],
  },
  {
    slug: 'debt-validation',
    title: 'Debt Validation',
    cluster: 'disputes',
    intent: 'education',
    offerPath: '/super-dispute',
    metaDescription:
      'Learn what debt validation is, when to request it, and how it differs from a credit bureau dispute.',
    audience: 'Consumers contacted by collectors or reviewing collection accounts.',
    overview:
      'Debt validation is a request to a debt collector for information about a debt. It is different from disputing a credit report item with a bureau. Both can matter, but they serve different purposes and should be tracked separately.',
    keyTakeaways: [
      'Debt validation goes to the collector, not the credit bureau.',
      'Timing can matter after first contact from a collector.',
      'Keep written records of requests and responses.',
    ],
    actionSteps: [
      'Identify the collector and the debt they claim to collect.',
      'Send a clear validation request when appropriate.',
      'Compare the collector response with your records and credit report.',
    ],
    faqs: [
      {
        question: 'Is debt validation the same as a dispute?',
        answer:
          'No. Validation requests information from a collector; credit disputes ask bureaus to investigate report information.',
      },
      {
        question: 'Should I validate before paying?',
        answer:
          'If you are unsure the debt is yours or the details are unclear, validation can help you make a more informed decision.',
      },
    ],
  },
  {
    slug: 'credit-utilization',
    title: 'Credit Utilization',
    cluster: 'credit-repair',
    intent: 'education',
    offerPath: '/dashboard',
    metaDescription:
      'Learn how credit utilization affects credit profiles and what practical steps can lower reported balances.',
    audience: 'People trying to improve revolving credit usage before they apply.',
    overview:
      'Credit utilization compares revolving balances with credit limits. Lower utilization can support stronger credit profiles, but the timing of reported balances matters. The goal is to manage what reports, not just what you pay by the due date.',
    keyTakeaways: [
      'Utilization is usually tied to the balance reported by the issuer.',
      'High utilization can hurt even when payments are on time.',
      'Lower balances, higher limits, or better timing can improve the picture.',
    ],
    actionSteps: [
      'List each card balance and limit.',
      'Prioritize cards with the highest utilization.',
      'Watch statement/reporting dates, not only due dates.',
    ],
    faqs: [
      {
        question: 'Is 30% utilization always the goal?',
        answer:
          'It is a common guideline, but lower can be better for many profiles. The best target depends on your full report and goals.',
      },
      {
        question: 'Does paying before the due date help utilization?',
        answer:
          'It can if the lower balance is reported to the bureaus. Reporting dates vary by issuer.',
      },
    ],
  },
  {
    slug: 'credit-repair-methods',
    title: 'Credit Repair Methods That Actually Make Sense',
    cluster: 'credit-repair',
    intent: 'education',
    offerPath: '/credit-upload',
    metaDescription:
      'Review the most practical credit repair methods: bureau disputes, direct furnisher disputes, identity theft blocks, debt validation, utilization cleanup, and timing-based follow-up.',
    audience: 'Consumers who want a realistic list of credit repair methods without gimmicks.',
    overview:
      'Effective credit repair usually comes down to a handful of repeatable methods: checking reports carefully, disputing inaccurate or mixed information, following up when results do not make sense, handling identity theft correctly, and improving the parts of the file that are hurting scores but are still accurate. VestBlock should teach methods that match real rights and real data, not magical deletion claims.',
    keyTakeaways: [
      'Start with a current credit report before choosing a method.',
      'Different problems call for different methods: bureau disputes, collector validation, furnisher disputes, or identity theft blocks.',
      'Profile cleanup methods like lower utilization can help even when no dispute is involved.',
    ],
    actionSteps: [
      'Separate inaccurate reporting issues from accurate but negative history.',
      'Use documentation-heavy methods first when the data is wrong or incomplete.',
      'Use utilization, payment, and timing improvements when the problem is accurate reporting rather than bad data.',
    ],
    faqs: [
      {
        question: 'Is there one best credit repair method for everyone?',
        answer:
          'No. The best method depends on whether the issue is inaccurate reporting, identity theft, a collector problem, a mixed file, or accurate but high-risk balances.',
      },
      {
        question: 'Can a good method remove accurate negative information?',
        answer:
          'Usually no. Accurate negative information generally stays until its reporting period ends unless a creditor voluntarily changes it or the reporting turns out to be wrong.',
      },
    ],
  },
  {
    slug: 'direct-furnisher-dispute',
    title: 'Direct Furnisher Disputes',
    cluster: 'disputes',
    intent: 'education',
    offerPath: '/tools/dispute-letters',
    metaDescription:
      'Learn when to dispute directly with the furnisher of credit information and how that differs from a bureau dispute.',
    audience: 'Consumers whose bureau dispute came back verified or who want the creditor or servicer to review the reporting directly.',
    overview:
      'A direct furnisher dispute goes to the company that supplied the information, such as a lender, servicer, or collector. This can be useful when a bureau dispute result does not make sense or when the reporting source itself needs to correct balances, dates, ownership, or account status.',
    keyTakeaways: [
      'A furnisher dispute is different from a bureau dispute and can be used alongside it.',
      'This method works best when you can point to a specific reporting problem.',
      'Good records matter: statements, payment proof, account history, and prior dispute responses.',
    ],
    actionSteps: [
      'Identify the exact furnisher reporting the account.',
      'Describe the reporting problem clearly and include supporting documents.',
      'Track when the dispute was sent and compare the furnisher response with the bureau result.',
    ],
    faqs: [
      {
        question: 'When should I dispute directly with the furnisher?',
        answer:
          'It is often useful when the bureau verified an item but the reporting still looks inaccurate, incomplete, or inconsistent with your records.',
      },
      {
        question: 'Does a furnisher dispute replace a bureau dispute?',
        answer:
          'Not always. Many consumers use both so the bureau and the reporting source each review the issue.',
      },
    ],
  },
  {
    slug: 'statement-of-dispute',
    title: 'Statement Of Dispute',
    cluster: 'disputes',
    intent: 'education',
    offerPath: '/credit-upload',
    metaDescription:
      'Learn when a statement of dispute can be added to a credit file after an unresolved dispute and what it can realistically do.',
    audience: 'Consumers whose dispute was not resolved and who want the file to reflect their side of the issue.',
    overview:
      'If a dispute is not resolved, a consumer can ask for a brief statement of dispute to be added to the file. This does not force deletion, but it can create a record that the item is contested and can appear in future reports.',
    keyTakeaways: [
      'This is a follow-up method, not a first-step dispute strategy.',
      'A statement of dispute does not remove the account by itself.',
      'It can still be useful when the record needs a written explanation attached to it.',
    ],
    actionSteps: [
      'Keep the unresolved dispute result letter.',
      'Draft a short, factual summary of the disagreement.',
      'Request that the statement be included in the file and future reports.',
    ],
    faqs: [
      {
        question: 'Will a statement of dispute improve my score?',
        answer:
          'Not directly. It is mainly a rights-based way to document that you disagree with how an item was handled.',
      },
      {
        question: 'Should I use a statement of dispute instead of disputing?',
        answer:
          'Usually no. It is normally a follow-up step after a dispute result, not a replacement for the original dispute.',
      },
    ],
  },
  {
    slug: 'identity-theft-block-and-fraud-alerts',
    title: 'Identity Theft Blocks And Fraud Alerts',
    cluster: 'disputes',
    intent: 'education',
    offerPath: '/tools/dispute-letters',
    metaDescription:
      'Learn when identity theft blocks, fraud alerts, and credit freezes are stronger than a regular dispute.',
    audience: 'Consumers dealing with unauthorized accounts, inquiries, or address history caused by identity theft.',
    overview:
      'Identity theft cases often need more than a standard dispute. Fraud alerts and credit freezes help prevent new fraud, while identity theft block rights can be used to stop reporting of accounts that resulted from identity theft when the proper report and identification are provided.',
    keyTakeaways: [
      'Fraud alerts and credit freezes are prevention tools.',
      'Identity theft block rights can be stronger than a generic dispute for fraudulent accounts.',
      'Documentation matters: identity theft reports, account lists, and proof of identity.',
    ],
    actionSteps: [
      'Freeze credit or place a fraud alert if new-account fraud is a concern.',
      'Report identity theft through the official government process and save the report.',
      'Use that report when disputing fraudulent accounts and requesting blocks.',
    ],
    faqs: [
      {
        question: 'Is a credit freeze the same as a dispute?',
        answer:
          'No. A freeze helps stop new credit from being opened, while a dispute challenges information already appearing on the report.',
      },
      {
        question: 'When is an identity theft block stronger than a normal dispute?',
        answer:
          'When the item truly resulted from identity theft and you can provide the required identity theft report and identification documents.',
      },
    ],
  },
  {
    slug: 'reinserted-information-after-dispute',
    title: 'Reinserted Information After A Dispute',
    cluster: 'disputes',
    intent: 'education',
    offerPath: '/tools/my-dispute-letters',
    metaDescription:
      'Understand what to review when a deleted item shows up again after a dispute and why reinsertion notice matters.',
    audience: 'Consumers who saw a disputed item disappear and then reappear.',
    overview:
      'When information is deleted and later comes back, the user should not assume the process was clean. Reinserted information should be reviewed carefully, including whether the furnisher recertified accuracy and whether proper notice was given.',
    keyTakeaways: [
      'A reappearing item deserves a fresh review, not blind acceptance.',
      'This is a follow-up method many consumers never think to use.',
      'Keep earlier reports and deletion results so you can compare what changed.',
    ],
    actionSteps: [
      'Save copies of reports showing the item removed and later reinserted.',
      'Review the new reporting date, balance, status, and furnisher details.',
      'Follow up quickly if the reinsertion still appears unsupported or inaccurate.',
    ],
    faqs: [
      {
        question: 'Can an item come back after it was deleted?',
        answer:
          'Yes, but it should be reviewed carefully. Reinserted information is supposed to meet accuracy and notice requirements.',
      },
      {
        question: 'Does reinsertion mean the item is automatically valid?',
        answer:
          'No. It means the reporting returned. You should still review whether the information is accurate and whether the process was handled correctly.',
      },
    ],
  },
  {
    slug: 'mixed-file-and-personal-info-disputes',
    title: 'Mixed File And Personal Information Disputes',
    cluster: 'disputes',
    intent: 'education',
    offerPath: '/tools/dispute-letters',
    metaDescription:
      'Learn how to challenge mixed-file problems, wrong addresses, name variations, and personal-information errors that can contaminate a credit report.',
    audience: 'Consumers whose reports show incorrect personal details or accounts that are not theirs.',
    overview:
      'Personal-information errors are easy to underestimate. Wrong addresses, name variants, or a mixed file can cause someone else’s data to land on the report and create bigger dispute problems later. Cleaning the identity layer of the report can make other disputes stronger.',
    keyTakeaways: [
      'Personal-information cleanup can be a first step, not an afterthought.',
      'A mixed file is a serious issue if accounts or addresses are not yours.',
      'The goal is to separate your file from anyone else’s data before working deeper disputes.',
    ],
    actionSteps: [
      'Review names, addresses, employers, and SSN fragments first.',
      'Flag any item that belongs to another person or another version of your file.',
      'Request correction of identity details before or alongside account disputes.',
    ],
    faqs: [
      {
        question: 'Why do personal-information disputes matter so much?',
        answer:
          'Because identity-layer errors can be the reason other inaccurate accounts or addresses are appearing in the first place.',
      },
      {
        question: 'What is a mixed file?',
        answer:
          'A mixed file is when a credit report contains information belonging to another person, often because identifiers are similar or merged incorrectly.',
      },
    ],
  },
  {
    slug: 'outdated-negative-information',
    title: 'Outdated Negative Information',
    cluster: 'credit-repair',
    intent: 'education',
    offerPath: '/credit-upload',
    metaDescription:
      'Learn how normal credit reporting time limits work and when old negative information may deserve a closer review.',
    audience: 'Consumers reviewing older collections, charge-offs, judgments, or bankruptcies.',
    overview:
      'Older negative information does not always disappear exactly when users expect, so timing reviews matter. Most adverse items have normal reporting limits, and users should compare those limits with the dates currently showing on the report before deciding what to challenge.',
    keyTakeaways: [
      'Most negative information is generally limited to about seven years, with some exceptions.',
      'Bankruptcies can remain longer than most other adverse items.',
      'A date review is useful when a user thinks an item should already be gone.',
    ],
    actionSteps: [
      'List the date of first delinquency, charge-off date, collection open date, and any update dates shown.',
      'Compare the item type with normal reporting-time limits.',
      'Challenge reporting that appears older than normal limits or is using the wrong timeline.',
    ],
    faqs: [
      {
        question: 'Can accurate negative information stay forever?',
        answer:
          'Usually no. Most negative information has reporting limits, although the exact period can vary by item type.',
      },
      {
        question: 'Should I dispute every old account?',
        answer:
          'Not automatically. First confirm the dates and whether the reporting actually appears to be beyond the normal reporting period.',
      },
    ],
  },
];

export function getAeoTopicsByCluster(cluster: AeoTopic['cluster']) {
  return vestblockAeoTopics.filter((topic) => topic.cluster === cluster);
}

export function getAeoTopicBySlug(slug: string) {
  return vestblockAeoTopics.find((topic) => topic.slug === slug) ?? null;
}

export function getRelatedAeoTopics(topic: AeoTopic, limit = 4) {
  return vestblockAeoTopics
    .filter((candidate) => candidate.slug !== topic.slug)
    .sort((a, b) => {
      const aScore =
        (a.cluster === topic.cluster ? 2 : 0) + (a.intent === topic.intent ? 1 : 0);
      const bScore =
        (b.cluster === topic.cluster ? 2 : 0) + (b.intent === topic.intent ? 1 : 0);
      return bScore - aScore || a.title.localeCompare(b.title);
    })
    .slice(0, limit);
}
