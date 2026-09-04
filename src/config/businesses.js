export const defaultBusiness = {
    id: "bistro-nube",
    name: "Bistro Nube",
    city: "Madrid",
    description: "Hamburguesería artesanal de barrio con producto local y servicio rápido.",
    address: "Calle de la Luna 18, Madrid",
    phone: "+34 910 000 000",
    openingHours: "Lunes a domingo, de 13:00 a 23:30",
    faq: "Alergias: consulta al equipo antes de confirmar. Reservas: no gestionamos reservas por teléfono.",
    services: [
        { name: "Manicura semipermanente", description: "Manicura completa con acabado semipermanente.", price: 25, durationMinutes: 45 },
        { name: "Pedicura spa", description: "Pedicura con exfoliación e hidratación.", price: 32, durationMinutes: 60 },
        { name: "Retirada de esmalte", description: "Retirada cuidadosa de producto anterior.", price: 8, durationMinutes: 20 }
    ],
    country: "ES",
    locale: "es-ES",
    timezone: "Europe/Madrid",
    serviceMode: "pickup_only",
    voice: {
        greeting: "Hola, Bistro Nube, habla tu asistente. Que te apetece pedir hoy?",
        twilioLanguage: "es-MX",
        twilioVoice: "Polly.Mia",
        deepgramSpeakModel: "aura-2-nestor-es",
        deepgramListenModel: "nova-3",
        deepgramLanguage: "es"
    },
    agent: {
        style: "tono calido, claro y profesional",
        maxResponseSentences: 2
    }
};
