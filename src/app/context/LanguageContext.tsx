import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Language = "es" | "en";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
  /** Inline text in both languages: L("Hola", "Hello") */
  L: (es: string, en: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined,
);

const translations = {
  es: {
    // Navigation
    "nav.features": "Características",
    "nav.howItWorks": "Cómo Funciona",

    // Hero Section
    "hero.badge": "Impulsado por la Experiencia Logística de SEAL",
    "hero.title": "Más claridad para",
    "hero.titleHighlight": "preparar tu importación",
    "hero.subtitle":
      "Un asistente de apoyo para explorar posibles proveedores, organizar estimaciones iniciales de costos e identificar aspectos logísticos y aduaneros que conviene revisar antes de avanzar.",
    "hero.placeholder": "Quiero importar sillas de madera desde China...",
    "hero.cta": "Comenzar orientación gratuita",
    "hero.noCreditCard":
      "Describe el producto que quieres importar y completa la información paso a paso.",
    "hero.formTitle": "Completa tu Perfil",
    "hero.nameLabel": "Nombre Completo",
    "hero.namePlaceholder": "Juan Pérez",
    "hero.emailLabel": "Correo Electrónico",
    "hero.emailPlaceholder": "juan@empresa.com",
    "hero.continue": "Continuar al Análisis",
    "hero.back": "← Atrás",
    "hero.processing": "Procesando...",

    // Trust Badges
    "trust.verified": "Referencias de proveedores para explorar",
    "trust.compliance": "Orientación inicial sobre aspectos aduaneros",
    "trust.pricing": "Estimaciones basadas en la información ingresada",
    "trust.network": "Experiencia logística de SEAL",

    // Features Section
    "features.title":
      "Herramientas para explorar tu importación",
    "features.subtitle":
      "Información inicial para ayudarte a preparar mejor tus próximos pasos.",
    "features.supplier.title": "Descubrimiento de proveedores",
    "features.supplier.desc":
      "Explora posibles opciones de abastecimiento y revisa la información disponible para investigarlas.",
    "features.cost.title": "Análisis de costos",
    "features.cost.desc":
      "Consulta una estimación preliminar basada en los datos que ingreses y en los supuestos utilizados.",
    "features.risk.title": "Aspectos por revisar",
    "features.risk.desc":
      "Identifica documentos, permisos y condiciones que podrían ser relevantes para tu producto y destino.",

    // How It Works
    "howItWorks.title": "De tu consulta a una guía inicial",
    "howItWorks.subtitle": "",
    "howItWorks.step1.title": "Describe",
    "howItWorks.step1.desc": "Cuéntanos qué producto quieres importar.",
    "howItWorks.step2.title": "Completa",
    "howItWorks.step2.desc": "Agrega información sobre cantidad, presupuesto y características del producto.",
    "howItWorks.step3.title": "Explora",
    "howItWorks.step3.desc": "Revisa referencias de proveedores, estimaciones y aspectos que conviene investigar.",
    "howItWorks.step4.title": "Continúa con SEAL",
    "howItWorks.step4.desc":
      "Si lo deseas, comparte tu caso con nuestro equipo para conversar sobre los siguientes pasos.",

    // Footer
    "footer.tagline": "Conectando Guatemala al Comercio Global",
    "footer.copyright": "© 2026 SEAL Guatemala. Todos los derechos reservados.",
    "footer.poweredby": "Desarrollado por",

    // Chat Interface
    "chat.newAnalysis": "Nuevo Análisis",
    "chat.conversations": "Conversaciones",
    "chat.savedReports": "Informes Guardados",
    "chat.title": "Asistente de orientación de SEAL",
    "chat.subtitle": "Organiza la información de tu importación a Guatemala",
    "chat.placeholder": "Pregunta sobre proveedores, costos, cumplimiento...",
    "chat.ctaTitle": "¿Listo para continuar?",
    "chat.ctaDesc":
      "Completa los datos del producto para revisar referencias de proveedores y una estimación preliminar de costos.",
    "chat.ctaButton": "Continuar a Calificación",

    // Product Qualification
    "qualification.title": "Calificación de Producto",
    "qualification.subtitle":
      "Explora posibles opciones de abastecimiento",
    "qualification.back": "Volver al Chat",
    "qualification.step": "Paso",
    "qualification.of": "de",
    "qualification.complete": "Completo",
    "qualification.productType": "Tipo de Producto",
    "qualification.selectCategory": "Seleccionar categoría de producto",
    "qualification.furniture": "Muebles",
    "qualification.electronics": "Electrónica",
    "qualification.textiles": "Textiles",
    "qualification.machinery": "Maquinaria",
    "qualification.other": "Otro",
    "qualification.material": "Material",
    "qualification.materialPlaceholder": "ej., Madera, Plástico, Metal",
    "qualification.productPlaceholder":
      "Describe el producto con el mayor detalle posible: qué es, para qué se usa, material, medidas, capacidad o voltaje, colores, marca o modelo de referencia, certificaciones que necesitas, empaque, etc.",
    "qualification.productHelp":
      "Cuantos más detalles compartas, mejor podremos organizar las referencias y los supuestos de la estimación.",
    "qualification.quantity": "Cantidad (unidades)",
    "qualification.budget": "Presupuesto (USD)",
    "qualification.destination": "País de destino",
    "qualification.selectDestination": "Seleccionar destino",
    "qualification.review": "Revisa tus Detalles",
    "qualification.product": "Producto:",
    "qualification.previous": "Anterior",
    "qualification.next": "Siguiente Paso",
    "qualification.findSuppliers": "Consultar referencias",

    // Supplier Results
    "suppliers.title": "Proveedores ordenados por índice referencial",
    "suppliers.found": "proveedores mejor clasificados",
    "suppliers.filtered": "filtrados",
    "suppliers.show": "Mostrar",
    "suppliers.hide": "Ocultar",
    "suppliers.filteredSuppliers": "proveedores filtrados",
    "suppliers.qualityFilter": "Reputación",
    "suppliers.qualityDesc": "Calificación ≥ 4.0 cuando tiene 5 o más reseñas",
    "suppliers.trustFilter": "Verificación",
    "suppliers.trustDesc": "Proveedor verificado, o miembro Gold con 3+ años",
    "suppliers.experienceFilter": "Pedido mínimo",
    "suppliers.experienceDesc": "Que puedas cumplir con tu cantidad",
    "suppliers.aiScore": "Índice referencial",
    "suppliers.aiScoreDesc": "Con datos publicados por la plataforma · mínimo 50/100 · niveles A (80+), B (65+), C (50+)",
    "suppliers.filteredOut": "Proveedores que no pasaron los filtros",
    "suppliers.notRecommended": "No recomendado",
    "suppliers.aiRecommended": "Orden sugerido (capacidad pedida, índice referencial y precio)",
    "suppliers.lowestPrice": "Precio Más Bajo",
    "suppliers.highestAI": "Mayor índice referencial",
    "suppliers.highestRating": "Calificación Más Alta",
    "suppliers.lowestMOQ": "MOQ Más Bajo",
    "suppliers.results": "resultados",
    "suppliers.matchScore": "Puntuación de Coincidencia IA",
    "suppliers.perUnit": "por unidad",
    "suppliers.moq": "MOQ",
    "suppliers.experience": "Trayectoria",
    "suppliers.response": "Respuesta",
    "suppliers.quality": "Protección de pedidos",
    "suppliers.contact": "Contactar Proveedor",
    "suppliers.aiRanking": "Índice referencial del proveedor",
    "suppliers.qualityScore": "Puntuación de Calidad",
    "suppliers.reliabilityScore": "Puntuación de Confiabilidad",
    "suppliers.priceScore": "Puntuación de Precio",
    "suppliers.overallScore": "Índice referencial",
    "suppliers.bestValue": "Mejor Valor",
    "suppliers.bestValueDesc":
      "ofrece la mejor relación calidad-precio según tu presupuesto y cantidad.",
    "suppliers.moqAnalysis": "Análisis MOQ",
    "suppliers.moqAnalysisDesc":
      "proveedores pueden cumplir con tu requisito de cantidad sin exceder el presupuesto.",
    "suppliers.priceAlert": "Alerta de Precio",
    "suppliers.priceAlertDesc":
      "Los precios actuales son 8% más bajos que el promedio del Q1 2026. Buen momento para ordenar.",
    "suppliers.selectedSupplier": "Proveedor Seleccionado",
    "suppliers.baseCost": "Costo Base:",
    "suppliers.estShipping": "Envío Est.:",
    "suppliers.estDuties": "Aranceles Est.:",
    "suppliers.totalEstimate": "Estimado Total:",
    "suppliers.viewCostBreakdown": "Ver Desglose Completo de Costos",
    "suppliers.savedLeads": "Leads Guardados",
    "suppliers.exportLeads": "Exportar Leads a CRM",
    "suppliers.generateLead": "Generar Lead",
    "suppliers.leadNotes": "Notas del Lead (Opcional)",
    "suppliers.leadNotesPlaceholder":
      "Agrega notas sobre este lead para tu equipo...",
    "suppliers.saveLead": "Guardar Lead y Enviar Consulta",
    "suppliers.cancel": "Cancelar",
    "suppliers.callManufacturer": "Llamar al Fabricante",
    "suppliers.viewOnAlibaba": "Ver en Alibaba",
    "suppliers.viewProduct": "Ver Producto",

    // Cost Breakdown
    "cost.title": "Estimación de costo total en Guatemala",
    "cost.subtitle": "Desglose completo de costos para tu importación de",
    "cost.exportPDF": "Exportar PDF",
    "cost.riskAssessment": "Aspectos por revisar",
    "cost.totalLandedCost": "Costo total estimado en Guatemala",
    "cost.forUnits": "Para 1,000 unidades",
    "cost.costDistribution": "Distribución de Costos",
    "cost.supplierComparison": "Comparación de Costos de Proveedores",
    "cost.detailedBreakdown": "Desglose Detallado de Costos",
    "cost.productCost": "Costo del Producto",
    "cost.oceanFreight": "Flete Marítimo",
    "cost.importDuties": "Aranceles de Importación",
    "cost.vatTaxes": "IVA e Impuestos",
    "cost.insurance": "Seguro",
    "cost.savingsTitle": "Ahorros Identificados",
    "cost.saving1": "Consolidar envío ahorra $1,200 vs. múltiples contenedores",
    "cost.saving2":
      "Proveedor seleccionado ofrece 5% descuento para pedidos superiores a 800 unidades",
    "cost.saving3":
      "La tasa arancelaria actual es favorable para importaciones de muebles de madera",
    "cost.considerationsTitle": "Consideraciones Adicionales",
    "cost.consideration1":
      "Términos de pago: 30% depósito, 70% antes del envío",
    "cost.consideration2":
      "Tiempo de entrega: 15-20 días producción + 25 días envío",
    "cost.consideration3":
      "Inspección de calidad recomendada antes del pago final",
    "cost.backToSuppliers": "← Proveedores",
    "cost.exportExcel": "Exportar Excel",
    "cost.dynamicCalc": "Cálculo dinámico",
    "cost.demoCalc":
      "Estimados de demostración — selecciona un proveedor para cálculo real",
    "cost.units": "unidades",
    "cost.destination": "destino:",
    "cost.perUnitLabel": "por unidad",
    "cost.lower": "menor ✅",
    "cost.higher": "mayor ⚠️",
    "cost.unitPrice": "Precio por unidad",
    "cost.is": "es",
    "cost.than": "que el presupuesto por unidad de",
    "cost.downloadFullReport": "Descargar Informe Completo (PDF)",

    // Risk & Compliance

    // Final CTA
    "final.complete": "Tu orientación está lista",
    "final.analyzed": "La herramienta revisó",
    "final.suppliers": "proveedores →",
    "final.qualifiedLeads": "proveedores que pasaron los filtros",
    "final.suppliersAnalyzed": "Proveedores Analizados",
    "final.filteredOut": "No pasaron los filtros",
    "final.qualified": "Pasaron los filtros",
    "final.topPicks": "Mostrados en resultados",
    "final.reportTitle": "Informe de Análisis de Importación",
    "final.reportSubtitle": "Orientación inicial de abastecimiento y costos",
    "final.reportID": "ID de Informe",
    "final.bestSupplier": "Proveedor considerado",
    "final.totalCost": "Costo total estimado en Guatemala",
    "final.riskLevel": "Nivel de Riesgo",
    "final.riskScore": "puntuación de riesgo",
    "final.reportContents": "Contenidos del Informe",
    "final.downloadReport": "Descargar Informe Completo",
    "final.exportLeads": "Exportar Leads",
    "final.leadsExported": "¡Leads Exportados Exitosamente!",
    "final.leadsExportedDesc":
      "leads de proveedores calificados han sido preparados para tu CRM",
    "final.exportIncludes": "La Exportación Incluye:",
    "final.include1": "Información completa de contacto del proveedor",
    "final.include2": "Índice referencial del proveedor y niveles",
    "final.include3": "Detalles de precios y MOQ",
    "final.include4": "Insignias y certificaciones declaradas",
    "final.include5": "Pasos recomendados para cada lead",
    "final.downloadCSV": "Descargar CSV para Importar CRM",
    "final.emailLeads": "Enviar prospectos al equipo por correo",
    "final.close": "Cerrar",
    "final.sealTitle": "Continúa tu importación con SEAL",
    "final.sealSubtitle":
      "Si lo deseas, el equipo de SEAL puede acompañarte con la logística y la aduana de tu importación.",
    "final.negotiation": "Negociación con Proveedores",
    "final.negotiationDesc": "Apoyo para negociar precios y términos",
    "final.qualityControl": "Control de Calidad",
    "final.qualityControlDesc": "Inspección previa al embarque como servicio adicional",
    "final.fullLogistics": "Logística Completa",
    "final.fullLogisticsDesc": "Gestión de entrega puerta a puerta",
    "final.requestQuote": "Solicitar Cotización",
    "final.scheduleCall": "Programar Llamada",
    "final.exportTitle": "Exportar este Análisis",
    "final.downloadExcel": "Descargar como Excel",
    "final.emailReport": "Enviar informe por correo",
    "final.nextSteps": "Próximos Pasos",
    "final.step1": "Revisar los datos del proveedor y contactar las mejores opciones",
    "final.step2":
      "Solicitar muestras de productos para verificación de calidad",
    "final.step3":
      "Preparar la documentación de la lista de aspectos por revisar",
    "final.step4":
      "Si lo deseas, apoyarte en SEAL para el acompañamiento logístico y aduanero de tu importación",
    "final.startNew": "Comenzar Nuevo Análisis",
    "final.basedOnReal": "Análisis basado en el proveedor considerado:",
    "final.demoData": "Mostrando datos de ejemplo",
    "final.perUnit": "por unidad",
    "final.verified": "Verificado",
    "final.standard": "Estándar",
    "final.pages": "páginas",
    "final.section1": "Resumen Ejecutivo",
    "final.section2Prefix": "Análisis de Proveedores",
    "final.section2Suffix": "Vendedores",
    "final.section3": "Desglose y Comparación de Costos",
    "final.section4": "Aspectos por revisar antes de importar",
    "final.section5": "Plan de Envío y Logística",
    "final.section6": "Lista de Verificación de Documentación",
    // Quote Modal
    "final.quoteModalTitle": "Solicitar Cotización",
    "final.quoteUnits": "unidades • Total estimado:",
    "final.quoteFullName": "Nombre completo *",
    "final.quoteEmail": "Correo *",
    "final.quotePhone": "Teléfono",
    "final.quoteCompany": "Empresa",
    "final.quoteMessage": "Mensaje adicional (opcional)",
    "final.quoteSubmit": "Enviar Solicitud",
    "final.quoteSending": "Enviando...",
    "final.quoteSuccess":
      "¡Solicitud enviada con éxito! Nuestro equipo te contactará pronto.",
    "final.quoteError":
      "⚠️ No se pudo enviar. Por favor intenta de nuevo o contáctanos directamente.",
    // Email Modal
    "final.emailModalTitle": "Enviar informe por correo",
    "final.emailModalDesc":
      "Te enviaremos el informe completo en PDF a tu correo.",
    "final.emailYourName": "Tu nombre",
    "final.emailYourEmail": "tu@correo.com *",
    "final.emailSubmit": "Enviar Informe",
    "final.emailSending": "Enviando...",
    "final.emailSuccess": "✅ ¡Informe enviado a tu correo!",
    "final.emailError":
      "⚠️ No se pudo enviar el informe. Por favor intenta de nuevo.",
  },
  en: {
    "nav.features": "Features",
    "nav.howItWorks": "How It Works",
    "hero.badge": "Backed by SEAL's Logistics Experience",
    "hero.title": "More clarity to",
    "hero.titleHighlight": "prepare your import",
    "hero.subtitle": "A support assistant to explore possible suppliers, organize initial cost estimates and identify logistics and customs aspects worth reviewing before moving forward.",
    "hero.placeholder": "I want to import wooden chairs from China...",
    "hero.cta": "Start free guidance",
    "hero.noCreditCard": "Describe the product you want to import and complete the information step by step.",
    "hero.formTitle": "Complete your profile",
    "hero.nameLabel": "Full name",
    "hero.namePlaceholder": "John Doe",
    "hero.emailLabel": "Email address",
    "hero.emailPlaceholder": "john@company.com",
    "hero.continue": "Continue",
    "hero.back": "← Back",
    "hero.processing": "Processing...",
    "trust.verified": "Supplier references to explore",
    "trust.compliance": "Initial guidance on customs aspects",
    "trust.pricing": "Estimates based on the information you enter",
    "trust.network": "SEAL's logistics experience",
    "features.title": "Tools to explore your import",
    "features.subtitle": "Initial information to help you better prepare your next steps.",
    "features.supplier.title": "Supplier discovery",
    "features.supplier.desc": "Explore possible sourcing options and review the available information to research them.",
    "features.cost.title": "Cost analysis",
    "features.cost.desc": "See a preliminary estimate based on the data you enter and the assumptions used.",
    "features.risk.title": "Aspects to review",
    "features.risk.desc": "Identify documents, permits and conditions that may be relevant for your product and destination.",
    "howItWorks.title": "From your question to an initial guide",
    "howItWorks.subtitle": "",
    "howItWorks.step1.title": "Describe",
    "howItWorks.step1.desc": "Tell us what product you want to import.",
    "howItWorks.step2.title": "Complete",
    "howItWorks.step2.desc": "Add information about quantity, budget and product characteristics.",
    "howItWorks.step3.title": "Explore",
    "howItWorks.step3.desc": "Review supplier references, estimates and aspects worth researching.",
    "howItWorks.step4.title": "Continue with SEAL",
    "howItWorks.step4.desc": "If you wish, share your case with our team to talk about the next steps.",
    "footer.tagline": "Connecting Guatemala to Global Trade",
    "footer.copyright": "© 2026 SEAL Guatemala. All rights reserved.",
    "footer.poweredby": "Developed by",
    "chat.newAnalysis": "New Analysis",
    "chat.conversations": "Conversations",
    "chat.savedReports": "Saved Reports",
    "chat.title": "SEAL guidance assistant",
    "chat.subtitle": "Organize the information for your import into Guatemala",
    "chat.placeholder": "Ask about suppliers, costs, compliance...",
    "chat.ctaTitle": "Ready to continue?",
    "chat.ctaDesc": "Complete the product details to review supplier references and a preliminary cost estimate.",
    "chat.ctaButton": "Continue to product details",
    "qualification.title": "Product details",
    "qualification.subtitle": "Explore possible sourcing options",
    "qualification.back": "Back to chat",
    "qualification.step": "Step",
    "qualification.of": "of",
    "qualification.complete": "complete",
    "qualification.productType": "Product type",
    "qualification.selectCategory": "Select product category",
    "qualification.furniture": "Furniture",
    "qualification.electronics": "Electronics",
    "qualification.textiles": "Textiles",
    "qualification.machinery": "Machinery",
    "qualification.other": "Other",
    "qualification.material": "Material",
    "qualification.materialPlaceholder": "e.g., Wood, Plastic, Metal",
    "qualification.productPlaceholder": "Describe the product in as much detail as possible: what it is, what it is used for, material, dimensions, capacity or voltage, colors, reference brand or model, certifications needed, packaging, etc.",
    "qualification.productHelp": "The more details you share, the better we can organize the references and the assumptions behind the estimate.",
    "qualification.quantity": "Quantity (units)",
    "qualification.budget": "Budget (USD)",
    "qualification.destination": "Destination country",
    "qualification.selectDestination": "Select destination",
    "qualification.review": "Review your details",
    "qualification.product": "Product:",
    "qualification.previous": "Previous",
    "qualification.next": "Next step",
    "qualification.findSuppliers": "Look up references",
    "suppliers.title": "Suppliers sorted by reference index",
    "suppliers.found": "top-ranked suppliers",
    "suppliers.filtered": "filtered out",
    "suppliers.show": "Show",
    "suppliers.hide": "Hide",
    "suppliers.filteredSuppliers": "filtered suppliers",
    "suppliers.qualityFilter": "Reputation",
    "suppliers.qualityDesc": "Rating ≥ 4.0 when it has 5 or more reviews",
    "suppliers.trustFilter": "Verification",
    "suppliers.trustDesc": "Verified Supplier, or Gold Supplier with 3+ years",
    "suppliers.experienceFilter": "Minimum order",
    "suppliers.experienceDesc": "One you can meet with your quantity",
    "suppliers.aiScore": "Reference index",
    "suppliers.aiScoreDesc": "From data published by the platform · minimum 50/100 · levels A (80+), B (65+), C (50+)",
    "suppliers.filteredOut": "Suppliers that did not pass the filters",
    "suppliers.notRecommended": "Not recommended",
    "suppliers.aiRecommended": "Suggested order (requested capacity, reference index and price)",
    "suppliers.lowestPrice": "Lowest price",
    "suppliers.highestAI": "Highest reference index",
    "suppliers.highestRating": "Highest rating",
    "suppliers.lowestMOQ": "Lowest MOQ",
    "suppliers.results": "results",
    "suppliers.matchScore": "Match score",
    "suppliers.perUnit": "per unit",
    "suppliers.moq": "MOQ",
    "suppliers.experience": "Track record",
    "suppliers.response": "Response",
    "suppliers.quality": "Trade Assurance",
    "suppliers.contact": "Contact supplier",
    "suppliers.aiRanking": "Supplier reference index",
    "suppliers.qualityScore": "Quality score",
    "suppliers.reliabilityScore": "Reliability score",
    "suppliers.priceScore": "Price score",
    "suppliers.overallScore": "Reference index",
    "suppliers.bestValue": "Best value",
    "suppliers.bestValueDesc": "offers the best price-to-quality ratio for your budget and quantity.",
    "suppliers.moqAnalysis": "MOQ analysis",
    "suppliers.moqAnalysisDesc": "suppliers can meet your quantity without exceeding the budget.",
    "suppliers.priceAlert": "Price alert",
    "suppliers.priceAlertDesc": "Current prices are 8% below the Q1 2026 average. Good time to order.",
    "suppliers.selectedSupplier": "Selected supplier",
    "suppliers.baseCost": "Base cost:",
    "suppliers.estShipping": "Est. shipping:",
    "suppliers.estDuties": "Est. duties:",
    "suppliers.totalEstimate": "Total estimate:",
    "suppliers.viewCostBreakdown": "View full cost breakdown",
    "suppliers.savedLeads": "Saved leads",
    "suppliers.exportLeads": "Export leads to CRM",
    "suppliers.generateLead": "Generate lead",
    "suppliers.leadNotes": "Lead notes (optional)",
    "suppliers.leadNotesPlaceholder": "Add notes about this lead for your team...",
    "suppliers.saveLead": "Save lead and send inquiry",
    "suppliers.cancel": "Cancel",
    "suppliers.callManufacturer": "Call manufacturer",
    "suppliers.viewOnAlibaba": "View on Alibaba",
    "suppliers.viewProduct": "View product",
    "cost.title": "Estimated total cost in Guatemala",
    "cost.subtitle": "Full cost breakdown for your import from",
    "cost.exportPDF": "Export PDF",
    "cost.riskAssessment": "Points to review",
    "cost.totalLandedCost": "Estimated total cost in Guatemala",
    "cost.forUnits": "For 1,000 units",
    "cost.costDistribution": "Cost distribution",
    "cost.supplierComparison": "Supplier cost comparison",
    "cost.detailedBreakdown": "Detailed cost breakdown",
    "cost.productCost": "Product cost",
    "cost.oceanFreight": "Ocean freight",
    "cost.importDuties": "Import duties",
    "cost.vatTaxes": "VAT and taxes",
    "cost.insurance": "Insurance",
    "cost.savingsTitle": "Savings identified",
    "cost.saving1": "Consolidating the shipment saves $1,200 vs. multiple containers",
    "cost.saving2": "Selected supplier offers a 5% discount on orders over 800 units",
    "cost.saving3": "Current duty rate is favorable for wooden furniture imports",
    "cost.considerationsTitle": "Additional considerations",
    "cost.consideration1": "Payment terms: 30% deposit, 70% before shipment",
    "cost.consideration2": "Lead time: 15-20 days production + 25 days shipping",
    "cost.consideration3": "Quality inspection recommended before final payment",
    "cost.backToSuppliers": "← Suppliers",
    "cost.exportExcel": "Export Excel",
    "cost.dynamicCalc": "Dynamic calculation",
    "cost.demoCalc": "Demo estimates — select a supplier for a real calculation",
    "cost.units": "units",
    "cost.destination": "destination:",
    "cost.perUnitLabel": "per unit",
    "cost.lower": "lower ✅",
    "cost.higher": "higher ⚠️",
    "cost.unitPrice": "Unit price",
    "cost.is": "is",
    "cost.than": "than the budget per unit of",
    "cost.downloadFullReport": "Download full report (PDF)",
    "final.complete": "Your guidance is ready",
    "final.analyzed": "The tool filtered",
    "final.suppliers": "suppliers →",
    "final.qualifiedLeads": "qualified suppliers",
    "final.suppliersAnalyzed": "Suppliers analyzed",
    "final.filteredOut": "Filtered out",
    "final.qualified": "Qualified",
    "final.topPicks": "Shown in results",
    "final.reportTitle": "Import analysis report",
    "final.reportSubtitle": "Initial sourcing and cost guidance",
    "final.reportID": "Report ID",
    "final.bestSupplier": "Supplier considered",
    "final.totalCost": "Estimated total cost in Guatemala",
    "final.riskLevel": "Risk level",
    "final.riskScore": "risk score",
    "final.reportContents": "Report contents",
    "final.downloadReport": "Download full report",
    "final.exportLeads": "Export leads",
    "final.leadsExported": "Leads exported successfully!",
    "final.leadsExportedDesc": "qualified supplier leads have been prepared for your CRM",
    "final.exportIncludes": "The export includes:",
    "final.include1": "Supplier contact information available",
    "final.include2": "Supplier reference index and levels",
    "final.include3": "Pricing and MOQ details",
    "final.include4": "Badges and declared certifications",
    "final.include5": "Suggested next steps for each lead",
    "final.downloadCSV": "Download CSV for CRM import",
    "final.emailLeads": "Email leads to the team",
    "final.close": "Close",
    "final.sealTitle": "Continue your import with SEAL",
    "final.sealSubtitle": "If you wish, the SEAL team can support you with the logistics and customs of your import.",
    "final.negotiation": "Supplier negotiation",
    "final.negotiationDesc": "Support to negotiate prices and terms",
    "final.qualityControl": "Quality control",
    "final.qualityControlDesc": "Pre-shipment inspection available as an additional service",
    "final.fullLogistics": "Full logistics",
    "final.fullLogisticsDesc": "Door-to-door delivery management",
    "final.requestQuote": "Request a quote",
    "final.scheduleCall": "Schedule a call",
    "final.exportTitle": "Export this analysis",
    "final.downloadExcel": "Download as Excel",
    "final.emailReport": "Email the report",
    "final.nextSteps": "Next steps",
    "final.step1": "Review the supplier details and contact the best options",
    "final.step2": "Request product samples to check quality",
    "final.step3": "Prepare the documentation from the list of points to review",
    "final.step4": "If you wish, rely on SEAL for logistics and customs support for your import",
    "final.startNew": "Start a new analysis",
    "final.basedOnReal": "Analysis based on the supplier considered:",
    "final.demoData": "Showing sample data",
    "final.perUnit": "per unit",
    "final.verified": "Verified",
    "final.standard": "Standard",
    "final.pages": "pages",
    "final.section1": "Executive summary",
    "final.section2Prefix": "Supplier analysis",
    "final.section2Suffix": "sellers",
    "final.section3": "Cost breakdown",
    "final.section4": "Points to review before importing",
    "final.section5": "Shipping and logistics plan",
    "final.section6": "Documentation checklist",
    "final.quoteModalTitle": "Request a quote",
    "final.quoteUnits": "units • Estimated total:",
    "final.quoteFullName": "Full name *",
    "final.quoteEmail": "Email *",
    "final.quotePhone": "Phone",
    "final.quoteCompany": "Company",
    "final.quoteMessage": "Additional message (optional)",
    "final.quoteSubmit": "Send request",
    "final.quoteSending": "Sending...",
    "final.quoteSuccess": "Request sent! Our team will contact you soon.",
    "final.quoteError": "⚠️ Could not send. Please try again or contact us directly.",
    "final.emailModalTitle": "Email the report",
    "final.emailModalDesc": "We will send the full PDF report to your email.",
    "final.emailYourName": "Your name",
    "final.emailYourEmail": "your@email.com *",
    "final.emailSubmit": "Send report",
    "final.emailSending": "Sending...",
    "final.emailSuccess": "✅ Report sent to your email!",
    "final.emailError": "⚠️ Could not send the report. Please try again.",
  },
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    let initial: Language = "es";
    try {
      initial = localStorage.getItem("seal_lang") === "en" ? "en" : "es";
    } catch {
      /* storage unavailable */
    }
    document.documentElement.lang = initial;
    return initial;
  });

  // <html lang> is set BEFORE re-rendering so code outside React (Lx) reads it
  const setLanguage = (lang: Language) => {
    document.documentElement.lang = lang;
    setLanguageState(lang);
  };

  // Keep <html lang> in sync and remember the choice
  useEffect(() => {
    document.documentElement.lang = language;
    try {
      localStorage.setItem("seal_lang", language);
    } catch {
      /* storage unavailable */
    }
  }, [language]);

  const t = (key: string): string => {
    const v = (translations[language] as Record<string, string>)[key];
    return v ?? key;
  };

  return (
    <LanguageContext.Provider
      value={{ language, setLanguage, t, L: (es: string, en: string) => (language === "en" ? en : es) }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}
