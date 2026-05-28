import { createContext, useContext, useState, ReactNode } from "react";

type Language = "es" | "en";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
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
    "hero.title": "Proveedores Clasificados. Costos Reales.",
    "hero.titleHighlight": "Menos Riesgo.",
    "hero.subtitle":
      "Asistente de importación impulsado por IA que te ayuda a encontrar proveedores, analizar costos y gestionar el comercio internacional con confianza",
    "hero.placeholder": "Quiero importar sillas de madera desde China...",
    "hero.cta": "Comenzar Análisis Gratis",
    "hero.noCreditCard":
      "No se requiere tarjeta de crédito • Obtén resultados en segundos",
    "hero.formTitle": "Completa tu Perfil",
    "hero.nameLabel": "Nombre Completo",
    "hero.namePlaceholder": "Juan Pérez",
    "hero.emailLabel": "Correo Electrónico",
    "hero.emailPlaceholder": "juan@empresa.com",
    "hero.continue": "Continuar al Análisis",
    "hero.back": "← Atrás",
    "hero.processing": "Procesando...",

    // Trust Badges
    "trust.verified": "Proveedores Verificados",
    "trust.compliance": "Cumplimiento Verificado",
    "trust.pricing": "Precios en Tiempo Real",
    "trust.network": "Red de Comercio Global",

    // Features Section
    "features.title":
      "Todo lo que necesitas para importar de manera más inteligente",
    "features.subtitle":
      "Información impulsada por IA respaldada por experiencia logística",
    "features.supplier.title": "Descubrimiento de Proveedores",
    "features.supplier.desc":
      "Encuentra proveedores verificados en Alibaba con calificaciones de calidad y requisitos de MOQ",
    "features.cost.title": "Análisis de Costos",
    "features.cost.desc":
      "Calcula costos totales desembarcados incluyendo aranceles, impuestos y envío",
    "features.risk.title": "Evaluación de Riesgos",
    "features.risk.desc":
      "Identifica problemas de cumplimiento y requisitos de documentación antes de ordenar",

    // How It Works
    "howItWorks.title": "Cómo funciona",
    "howItWorks.subtitle": "De consulta a cotización en minutos",
    "howItWorks.step1.title": "Describe",
    "howItWorks.step1.desc": "Dinos qué quieres importar",
    "howItWorks.step2.title": "Califica",
    "howItWorks.step2.desc": "Responde algunas preguntas sobre tus necesidades",
    "howItWorks.step3.title": "Analiza",
    "howItWorks.step3.desc": "La IA encuentra proveedores y calcula costos",
    "howItWorks.step4.title": "Importa",
    "howItWorks.step4.desc":
      "Obtén tu informe completo y deja la operación en manos de SEAL",

    // Footer
    "footer.tagline": "Conectando Guatemala al Comercio Global",
    "footer.copyright": "© 2026 SEAL Guatemala. Todos los derechos reservados.",
    "footer.poweredby": "Desarrollado por",

    // Chat Interface
    "chat.newAnalysis": "Nuevo Análisis",
    "chat.conversations": "Conversaciones",
    "chat.savedReports": "Informes Guardados",
    "chat.title": "Asistente de Análisis de Importación",
    "chat.subtitle": "Experto en abastecimiento y aduanas impulsado por IA",
    "chat.placeholder": "Pregunta sobre proveedores, costos, cumplimiento...",
    "chat.ctaTitle": "¿Listo para encontrar proveedores?",
    "chat.ctaDesc":
      "Completa la calificación del producto para obtener coincidencias precisas de proveedores y estimaciones de costos.",
    "chat.ctaButton": "Continuar a Calificación",

    // Product Qualification
    "qualification.title": "Calificación de Producto",
    "qualification.subtitle":
      "Ayúdanos a encontrar los proveedores perfectos para tus necesidades",
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
    "qualification.quantity": "Cantidad (unidades)",
    "qualification.budget": "Presupuesto (USD)",
    "qualification.destination": "País de Destino",
    "qualification.selectDestination": "Seleccionar destino",
    "qualification.review": "Revisa tus Detalles",
    "qualification.product": "Producto:",
    "qualification.previous": "Anterior",
    "qualification.next": "Siguiente Paso",
    "qualification.findSuppliers": "Encontrar Proveedores",

    // Supplier Results
    "suppliers.title": "Resultados de Proveedores Filtrados por IA",
    "suppliers.found": "proveedores mejor clasificados",
    "suppliers.filtered": "filtrados",
    "suppliers.show": "Mostrar",
    "suppliers.hide": "Ocultar",
    "suppliers.filteredSuppliers": "proveedores filtrados",
    "suppliers.qualityFilter": "Filtro de Calidad",
    "suppliers.qualityDesc": "Calificación ≥ 4.4 • Reseñas ≥ 400",
    "suppliers.trustFilter": "Filtro de Confianza",
    "suppliers.trustDesc": "Verificado • Respuesta ≥ 85%",
    "suppliers.experienceFilter": "Filtro de Experiencia",
    "suppliers.experienceDesc": "5+ años en el negocio",
    "suppliers.aiScore": "Puntuación IA",
    "suppliers.aiScoreDesc": "Puntuación de coincidencia ≥ 80/100",
    "suppliers.filteredOut": "Proveedores Filtrados por IA",
    "suppliers.notRecommended": "No recomendado",
    "suppliers.aiRecommended": "IA Recomendado (Mejor Coincidencia)",
    "suppliers.lowestPrice": "Precio Más Bajo",
    "suppliers.highestAI": "Puntuación IA Más Alta",
    "suppliers.highestRating": "Calificación Más Alta",
    "suppliers.lowestMOQ": "MOQ Más Bajo",
    "suppliers.results": "resultados",
    "suppliers.matchScore": "Puntuación de Coincidencia IA",
    "suppliers.perUnit": "por unidad",
    "suppliers.moq": "MOQ",
    "suppliers.experience": "Experiencia",
    "suppliers.response": "Respuesta",
    "suppliers.quality": "Calidad",
    "suppliers.contact": "Contactar Proveedor",
    "suppliers.aiRanking": "Lógica de Clasificación IA",
    "suppliers.qualityScore": "Puntuación de Calidad",
    "suppliers.reliabilityScore": "Puntuación de Confiabilidad",
    "suppliers.priceScore": "Puntuación de Precio",
    "suppliers.overallScore": "Puntuación General IA",
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
    "cost.title": "Análisis de Costo Total Desembarcado",
    "cost.subtitle": "Desglose completo de costos para tu importación de",
    "cost.exportPDF": "Exportar PDF",
    "cost.riskAssessment": "Evaluación de Riesgos",
    "cost.totalLandedCost": "Costo Total Desembarcado",
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
    "risk.title": "Evaluación de Riesgos y Cumplimiento",
    "risk.subtitle":
      "Análisis integral de riesgos potenciales y requisitos regulatorios",
    "risk.generateReport": "Generar Informe",
    "risk.report": "Informe",
    "risk.backToCosts": "← Costos",
    "risk.dynamicAnalysis": "Análisis dinámico para",
    "risk.genericAnalysis":
      "Análisis genérico — selecciona un proveedor para datos precisos",
    "risk.overallRiskScore": "Puntuación General de Riesgo",
    "risk.riskLevel": "Nivel de Riesgo",
    "risk.riskWord": "RIESGO",
    "risk.reviewWarnings": "Revisar advertencias cuidadosamente",
    "risk.lowRiskLabel": "Bajo Riesgo",
    "risk.highRiskLabel": "Alto Riesgo",
    "risk.low": "BAJO",
    "risk.medium": "MEDIO",
    "risk.high": "ALTO",
    "risk.lowMessage": "Seguro proceder con precaución",
    "risk.warnings": "Advertencias de Riesgo",
    "risk.warningsFor": "Para:",
    "risk.recommendation": "Recomendación:",
    "risk.requiredDocs": "Documentación Requerida",
    "risk.destinationLabel": "Destino:",
    "risk.required": "requerido",
    "risk.recommended": "recomendado",
    "risk.optional": "opcional",
    "risk.complianceChecks": "Verificaciones de Cumplimiento",
    "risk.checksPassed": "Verificaciones Aprobadas",
    "risk.regionalInsights": "Perspectivas Regionales",
    "risk.insight1":
      "Relaciones comerciales China-EE.UU. estables para importaciones de muebles",
    "risk.insight2": "Proveedor ubicado en centro de fabricación establecido",
    "risk.insight3": "Bajo riesgo político para esta categoría de producto",
    "risk.overallAssessment": "Evaluación General",
    "risk.assessmentText":
      "Esta importación tiene un perfil de riesgo general bajo. Aborda las advertencias de prioridad media antes de proceder y asegúrate de que toda la documentación requerida esté preparada.",
    "risk.assessmentLow1": "Esta importación tiene un perfil de riesgo",
    "risk.assessmentLow2":
      "El proveedor cumple con la mayoría de los criterios.",
    "risk.assessmentLow3":
      "Atender las verificaciones pendientes antes de proceder.",
    "risk.assessmentMedium":
      "Esta importación tiene riesgo medio. Revisar todas las advertencias y completar las verificaciones de cumplimiento antes de proceder.",
    "risk.assessmentHigh":
      "Esta importación tiene riesgo alto. Se recomienda revisar cuidadosamente todas las advertencias y considerar proveedores alternativos.",
    "risk.supplierAnalyzed": "Proveedor Analizado",
    "risk.aiScoreLabel": "Puntuación IA:",
    "risk.yearsInBusiness": "Años en negocio:",
    "risk.responseRate": "Tasa de respuesta:",

    // Final CTA
    "final.complete": "¡Tu Análisis está Completo!",
    "final.analyzed": "La IA filtró",
    "final.suppliers": "proveedores →",
    "final.qualifiedLeads": "leads calificados",
    "final.suppliersAnalyzed": "Proveedores Analizados",
    "final.filteredOut": "Filtrados (Baja Calidad)",
    "final.qualified": "Leads Calificados",
    "final.topPicks": "Mejores Selecciones IA",
    "final.reportTitle": "Informe de Análisis de Importación",
    "final.reportSubtitle": "Análisis integral de abastecimiento y costos",
    "final.reportID": "ID de Informe",
    "final.bestSupplier": "Mejor Proveedor",
    "final.totalCost": "Costo Total Desembarcado",
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
    "final.include2": "Puntuaciones de calidad IA y clasificaciones",
    "final.include3": "Detalles de precios y MOQ",
    "final.include4": "Estado de verificación y certificaciones",
    "final.include5": "Pasos recomendados para cada lead",
    "final.downloadCSV": "Descargar CSV para Importar CRM",
    "final.emailLeads": "Enviar Leads al Equipo por Email",
    "final.close": "Cerrar",
    "final.sealTitle": "Deja que SEAL Maneje tu Importación",
    "final.sealSubtitle":
      "¿Por qué gestionar la logística tú mismo? Deja que nuestros expertos manejen todo desde el abastecimiento hasta la entrega.",
    "final.negotiation": "Negociación con Proveedores",
    "final.negotiationDesc": "Obtén mejores precios y términos",
    "final.qualityControl": "Control de Calidad",
    "final.qualityControlDesc": "Inspecciones previas al envío incluidas",
    "final.fullLogistics": "Logística Completa",
    "final.fullLogisticsDesc": "Gestión de entrega puerta a puerta",
    "final.requestQuote": "Solicitar Cotización",
    "final.scheduleCall": "Programar Llamada",
    "final.exportTitle": "Exportar este Análisis",
    "final.downloadExcel": "Descargar como Excel",
    "final.emailReport": "Enviar Informe por Email",
    "final.nextSteps": "Próximos Pasos",
    "final.step1": "Revisar detalles del proveedor y contactar los 3 mejores",
    "final.step2":
      "Solicitar muestras de productos para verificación de calidad",
    "final.step3":
      "Preparar documentación requerida de la lista de cumplimiento",
    "final.step4":
      "Considerar servicio completo de logística SEAL para importación sin complicaciones",
    "final.startNew": "Comenzar Nuevo Análisis",
    "final.basedOnReal": "Análisis basado en proveedor real:",
    "final.demoData": "Mostrando datos de ejemplo",
    "final.perUnit": "por unidad",
    "final.verified": "Verificado",
    "final.standard": "Estándar",
    "final.pages": "páginas",
    "final.section1": "Resumen Ejecutivo",
    "final.section2Prefix": "Análisis de Proveedores",
    "final.section2Suffix": "Vendedores",
    "final.section3": "Desglose y Comparación de Costos",
    "final.section4": "Evaluación de Riesgos y Cumplimiento",
    "final.section5": "Plan de Envío y Logística",
    "final.section6": "Lista de Verificación de Documentación",
    // Quote Modal
    "final.quoteModalTitle": "Solicitar Cotización",
    "final.quoteUnits": "unidades • Total estimado:",
    "final.quoteFullName": "Nombre completo *",
    "final.quoteEmail": "Email *",
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
    "final.emailModalTitle": "Enviar Informe por Email",
    "final.emailModalDesc":
      "Te enviaremos el informe completo en PDF a tu correo.",
    "final.emailYourName": "Tu nombre",
    "final.emailYourEmail": "tu@email.com *",
    "final.emailSubmit": "Enviar Informe",
    "final.emailSending": "Enviando...",
    "final.emailSuccess": "✅ ¡Informe enviado a tu correo!",
    "final.emailError":
      "⚠️ No se pudo enviar el informe. Por favor intenta de nuevo.",
  },
  en: {
    // Navigation
    "nav.features": "Features",
    "nav.howItWorks": "How It Works",

    // Hero Section
    "hero.badge": "Powered by SEAL Logistics Expertise",
    "hero.title": "Ranked Suppliers. Real Costs.",
    "hero.titleHighlight": "Less Risk.",
    "hero.subtitle":
      "AI-powered import assistant that helps you find suppliers, analyze costs, and manage international trade with confidence",
    "hero.placeholder": "I want to import wooden chairs from China...",
    "hero.cta": "Start Free Analysis",
    "hero.noCreditCard": "No credit card required • Get results in seconds",
    "hero.formTitle": "Complete Your Profile",
    "hero.nameLabel": "Full Name",
    "hero.namePlaceholder": "John Doe",
    "hero.emailLabel": "Email Address",
    "hero.emailPlaceholder": "john@company.com",
    "hero.continue": "Continue to Analysis",
    "hero.back": "← Back",
    "hero.processing": "Processing...",

    // Trust Badges
    "trust.verified": "Verified Suppliers",
    "trust.compliance": "Compliance Checked",
    "trust.pricing": "Real-time Pricing",
    "trust.network": "Global Trade Network",

    // Features Section
    "features.title": "Everything you need to import smarter",
    "features.subtitle": "AI-powered insights backed by logistics expertise",
    "features.supplier.title": "Supplier Discovery",
    "features.supplier.desc":
      "Find verified suppliers on Alibaba with quality ratings and MOQ requirements",
    "features.cost.title": "Cost Analysis",
    "features.cost.desc":
      "Calculate total landed costs including duties, taxes, and shipping",
    "features.risk.title": "Risk Assessment",
    "features.risk.desc":
      "Identify compliance issues and documentation requirements before you order",

    // How It Works
    "howItWorks.title": "How it works",
    "howItWorks.subtitle": "From query to quote in minutes",
    "howItWorks.step1.title": "Describe",
    "howItWorks.step1.desc": "Tell us what you want to import",
    "howItWorks.step2.title": "Qualify",
    "howItWorks.step2.desc": "Answer a few questions about your needs",
    "howItWorks.step3.title": "Analyze",
    "howItWorks.step3.desc": "AI finds suppliers and calculates costs",
    "howItWorks.step4.title": "Import",
    "howItWorks.step4.desc": "Get your full report or let SEAL handle it",

    // Footer
    "footer.tagline": "Connecting Guatemala to Global Trade",
    "footer.copyright": "© 2026 SEAL Guatemala. All rights reserved.",
    "footer.poweredby": "Powered by",

    // Chat Interface
    "chat.newAnalysis": "New Analysis",
    "chat.conversations": "Conversations",
    "chat.savedReports": "Saved Reports",
    "chat.title": "Import Analysis Assistant",
    "chat.subtitle": "AI-powered sourcing and customs expert",
    "chat.placeholder": "Ask about suppliers, costs, compliance...",
    "chat.ctaTitle": "Ready to find suppliers?",
    "chat.ctaDesc":
      "Complete the product qualification to get accurate supplier matches and cost estimates.",
    "chat.ctaButton": "Continue to Qualification",

    // Product Qualification
    "qualification.title": "Product Qualification",
    "qualification.subtitle":
      "Help us find the perfect suppliers for your needs",
    "qualification.back": "Back to Chat",
    "qualification.step": "Step",
    "qualification.of": "of",
    "qualification.complete": "Complete",
    "qualification.productType": "Product Type",
    "qualification.selectCategory": "Select product category",
    "qualification.furniture": "Furniture",
    "qualification.electronics": "Electronics",
    "qualification.textiles": "Textiles",
    "qualification.machinery": "Machinery",
    "qualification.other": "Other",
    "qualification.material": "Material",
    "qualification.materialPlaceholder": "e.g., Wood, Plastic, Metal",
    "qualification.quantity": "Quantity (units)",
    "qualification.budget": "Budget (USD)",
    "qualification.destination": "Destination Country",
    "qualification.selectDestination": "Select destination",
    "qualification.review": "Review Your Details",
    "qualification.product": "Product:",
    "qualification.previous": "Previous",
    "qualification.next": "Next Step",
    "qualification.findSuppliers": "Find Suppliers",

    // Supplier Results
    "suppliers.title": "AI-Filtered Supplier Results",
    "suppliers.found": "top-ranked suppliers",
    "suppliers.filtered": "filtered out",
    "suppliers.show": "Show",
    "suppliers.hide": "Hide",
    "suppliers.filteredSuppliers": "filtered suppliers",
    "suppliers.qualityFilter": "Quality Filter",
    "suppliers.qualityDesc": "Rating ≥ 4.4 • Reviews ≥ 400",
    "suppliers.trustFilter": "Trust Filter",
    "suppliers.trustDesc": "Verified • Response ≥ 85%",
    "suppliers.experienceFilter": "Experience Filter",
    "suppliers.experienceDesc": "5+ years in business",
    "suppliers.aiScore": "AI Score",
    "suppliers.aiScoreDesc": "Match score ≥ 80/100",
    "suppliers.filteredOut": "Suppliers Filtered Out by AI",
    "suppliers.notRecommended": "Not recommended",
    "suppliers.aiRecommended": "AI Recommended (Best Match)",
    "suppliers.lowestPrice": "Lowest Price",
    "suppliers.highestAI": "Highest AI Score",
    "suppliers.highestRating": "Highest Rating",
    "suppliers.lowestMOQ": "Lowest MOQ",
    "suppliers.results": "results",
    "suppliers.matchScore": "AI Match Score",
    "suppliers.perUnit": "per unit",
    "suppliers.moq": "MOQ",
    "suppliers.experience": "Experience",
    "suppliers.response": "Response",
    "suppliers.quality": "Quality",
    "suppliers.contact": "Contact Supplier",
    "suppliers.aiRanking": "AI Ranking Logic",
    "suppliers.qualityScore": "Quality Score",
    "suppliers.reliabilityScore": "Reliability Score",
    "suppliers.priceScore": "Price Score",
    "suppliers.overallScore": "Overall AI Score",
    "suppliers.bestValue": "Best Value",
    "suppliers.bestValueDesc":
      "offers the best price-to-quality ratio based on your budget and quantity.",
    "suppliers.moqAnalysis": "MOQ Analysis",
    "suppliers.moqAnalysisDesc":
      "suppliers can meet your quantity requirement without exceeding budget.",
    "suppliers.priceAlert": "Price Alert",
    "suppliers.priceAlertDesc":
      "Current prices are 8% lower than Q1 2026 average. Good time to order.",
    "suppliers.selectedSupplier": "Selected Supplier",
    "suppliers.baseCost": "Base Cost:",
    "suppliers.estShipping": "Est. Shipping:",
    "suppliers.estDuties": "Est. Duties:",
    "suppliers.totalEstimate": "Total Estimate:",
    "suppliers.viewCostBreakdown": "View Full Cost Breakdown",
    "suppliers.savedLeads": "Saved Leads",
    "suppliers.exportLeads": "Export Leads to CRM",
    "suppliers.generateLead": "Generate Lead",
    "suppliers.leadNotes": "Lead Notes (Optional)",
    "suppliers.leadNotesPlaceholder":
      "Add notes about this lead for your team...",
    "suppliers.saveLead": "Save Lead & Send Inquiry",
    "suppliers.cancel": "Cancel",
    "suppliers.callManufacturer": "Call Manufacturer",
    "suppliers.viewOnAlibaba": "View on Alibaba",
    "suppliers.viewProduct": "View Product",

    // Cost Breakdown
    "cost.title": "Total Landed Cost Analysis",
    "cost.subtitle": "Complete cost breakdown for your import from",
    "cost.exportPDF": "Export PDF",
    "cost.riskAssessment": "Risk Assessment",
    "cost.totalLandedCost": "Total Landed Cost",
    "cost.forUnits": "For 1,000 units",
    "cost.costDistribution": "Cost Distribution",
    "cost.supplierComparison": "Supplier Cost Comparison",
    "cost.detailedBreakdown": "Detailed Cost Breakdown",
    "cost.productCost": "Product Cost",
    "cost.oceanFreight": "Ocean Freight",
    "cost.importDuties": "Import Duties",
    "cost.vatTaxes": "VAT & Taxes",
    "cost.insurance": "Insurance",
    "cost.savingsTitle": "Cost Savings Identified",
    "cost.saving1":
      "Consolidating shipment saves $1,200 vs. multiple containers",
    "cost.saving2":
      "Selected supplier offers 5% discount for orders over 800 units",
    "cost.saving3":
      "Current duty rate is favorable for wooden furniture imports",
    "cost.considerationsTitle": "Additional Considerations",
    "cost.consideration1": "Payment terms: 30% deposit, 70% before shipment",
    "cost.consideration2":
      "Lead time: 15-20 days production + 25 days shipping",
    "cost.consideration3":
      "Quality inspection recommended before final payment",
    "cost.backToSuppliers": "← Suppliers",
    "cost.exportExcel": "Export Excel",
    "cost.dynamicCalc": "Dynamic calculation",
    "cost.demoCalc": "Demo estimates — select a supplier for real calculation",
    "cost.units": "units",
    "cost.destination": "destination:",
    "cost.perUnitLabel": "per unit",
    "cost.lower": "lower ✅",
    "cost.higher": "higher ⚠️",
    "cost.unitPrice": "Price per unit",
    "cost.is": "is",
    "cost.than": "than the budget per unit of",
    "cost.downloadFullReport": "Download Full Report (PDF)",

    // Risk & Compliance
    "risk.title": "Risk & Compliance Assessment",
    "risk.subtitle":
      "Comprehensive analysis of potential risks and regulatory requirements",
    "risk.generateReport": "Generate Report",
    "risk.report": "Report",
    "risk.backToCosts": "← Costs",
    "risk.dynamicAnalysis": "Dynamic analysis for",
    "risk.genericAnalysis":
      "Generic analysis — select a supplier for accurate data",
    "risk.overallRiskScore": "Overall Risk Score",
    "risk.riskLevel": "Risk Level",
    "risk.riskWord": "RISK",
    "risk.reviewWarnings": "Review warnings carefully",
    "risk.lowRiskLabel": "Low Risk",
    "risk.highRiskLabel": "High Risk",
    "risk.low": "LOW",
    "risk.medium": "MEDIUM",
    "risk.high": "HIGH",
    "risk.lowMessage": "Safe to proceed with caution",
    "risk.warnings": "Risk Warnings",
    "risk.warningsFor": "For:",
    "risk.recommendation": "Recommendation:",
    "risk.requiredDocs": "Required Documentation",
    "risk.destinationLabel": "Destination:",
    "risk.required": "required",
    "risk.recommended": "recommended",
    "risk.optional": "optional",
    "risk.complianceChecks": "Compliance Checks",
    "risk.checksPassed": "Checks Passed",
    "risk.regionalInsights": "Regional Insights",
    "risk.insight1": "China-US trade relations stable for furniture imports",
    "risk.insight2": "Supplier located in established manufacturing hub",
    "risk.insight3": "Low political risk for this product category",
    "risk.overallAssessment": "Overall Assessment",
    "risk.assessmentText":
      "This import has a low overall risk profile. Address the medium-priority warnings before proceeding, and ensure all required documentation is prepared.",
    "risk.assessmentLow1": "This import has a risk profile of",
    "risk.assessmentLow2": "The supplier meets most criteria.",
    "risk.assessmentLow3": "Address pending checks before proceeding.",
    "risk.assessmentMedium":
      "This import has medium risk. Review all warnings and complete compliance checks before proceeding.",
    "risk.assessmentHigh":
      "This import has high risk. We recommend carefully reviewing all warnings and considering alternative suppliers.",
    "risk.supplierAnalyzed": "Analyzed Supplier",
    "risk.aiScoreLabel": "AI Score:",
    "risk.yearsInBusiness": "Years in business:",
    "risk.responseRate": "Response rate:",

    // Final CTA
    "final.complete": "Your Analysis is Complete!",
    "final.analyzed": "AI filtered",
    "final.suppliers": "suppliers →",
    "final.qualifiedLeads": "qualified leads",
    "final.suppliersAnalyzed": "Suppliers Analyzed",
    "final.filteredOut": "Filtered Out (Low Quality)",
    "final.qualified": "Qualified Leads",
    "final.topPicks": "AI Top Picks",
    "final.reportTitle": "Import Analysis Report",
    "final.reportSubtitle": "Comprehensive sourcing and cost analysis",
    "final.reportID": "Report ID",
    "final.bestSupplier": "Best Supplier",
    "final.totalCost": "Total Landed Cost",
    "final.riskLevel": "Risk Level",
    "final.riskScore": "risk score",
    "final.reportContents": "Report Contents",
    "final.downloadReport": "Download Full Report",
    "final.exportLeads": "Export Leads",
    "final.leadsExported": "Leads Exported Successfully!",
    "final.leadsExportedDesc":
      "qualified supplier leads have been prepared for your CRM",
    "final.exportIncludes": "Export Includes:",
    "final.include1": "Complete supplier contact information",
    "final.include2": "AI quality scores and rankings",
    "final.include3": "Pricing and MOQ details",
    "final.include4": "Verification status and certifications",
    "final.include5": "Recommended next steps for each lead",
    "final.downloadCSV": "Download CSV for CRM Import",
    "final.emailLeads": "Email Leads to Team",
    "final.close": "Close",
    "final.sealTitle": "Let SEAL Handle Your Import",
    "final.sealSubtitle":
      "Why manage logistics yourself? Let our experts handle everything from sourcing to delivery.",
    "final.negotiation": "Supplier Negotiation",
    "final.negotiationDesc": "Get better prices and terms",
    "final.qualityControl": "Quality Control",
    "final.qualityControlDesc": "Pre-shipment inspections included",
    "final.fullLogistics": "Full Logistics",
    "final.fullLogisticsDesc": "Door-to-door delivery management",
    "final.requestQuote": "Request Quote",
    "final.scheduleCall": "Schedule Call",
    "final.exportTitle": "Export This Analysis",
    "final.downloadExcel": "Download as Excel",
    "final.emailReport": "Email Report",
    "final.nextSteps": "Next Steps",
    "final.step1": "Review supplier details and contact top 3 matches",
    "final.step2": "Request product samples for quality verification",
    "final.step3": "Prepare required documentation from compliance list",
    "final.step4":
      "Consider SEAL full-service logistics for hassle-free import",
    "final.startNew": "Start New Analysis",
    "final.basedOnReal": "Analysis based on real supplier:",
    "final.demoData": "Showing demo data",
    "final.perUnit": "per unit",
    "final.verified": "Verified",
    "final.standard": "Standard",
    "final.pages": "pages",
    "final.section1": "Executive Summary",
    "final.section2Prefix": "Supplier Analysis",
    "final.section2Suffix": "Vendors",
    "final.section3": "Cost Breakdown and Comparison",
    "final.section4": "Risk and Compliance Assessment",
    "final.section5": "Shipping and Logistics Plan",
    "final.section6": "Documentation Checklist",
    // Quote Modal
    "final.quoteModalTitle": "Request Quote",
    "final.quoteUnits": "units • Total estimate:",
    "final.quoteFullName": "Full name *",
    "final.quoteEmail": "Email *",
    "final.quotePhone": "Phone",
    "final.quoteCompany": "Company",
    "final.quoteMessage": "Additional message (optional)",
    "final.quoteSubmit": "Send Request",
    "final.quoteSending": "Sending...",
    "final.quoteSuccess":
      "Request sent successfully! Our team will contact you soon.",
    "final.quoteError":
      "⚠️ Could not send. Please try again or contact us directly.",
    // Email Modal
    "final.emailModalTitle": "Email Report",
    "final.emailModalDesc":
      "We will send you the full PDF report to your email.",
    "final.emailYourName": "Your name",
    "final.emailYourEmail": "your@email.com *",
    "final.emailSubmit": "Send Report",
    "final.emailSending": "Sending...",
    "final.emailSuccess": "✅ Report sent to your email!",
    "final.emailError": "⚠️ Could not send the report. Please try again.",
  },
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("es");

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
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
