export const defaultBusiness = {
    id: "bistro-nube",
    name: "Bistro Nube",
    city: "Madrid",
    country: "ES",
    locale: "es-ES",
    timezone: "Europe/Madrid",
    serviceMode: "pickup_only",
    voice: {
        greeting: "Hola, Bistro Nube, habla tu asistente. Que te apetece pedir hoy?",
        twilioLanguage: "es-MX",
        twilioVoice: "Polly.Mia",
        deepgramSpeakModel: "aura-2-gloria-es",
        deepgramListenModel: "nova-3",
        deepgramLanguage: "es"
    },
    agent: {
        style: "tono calido, claro y profesional",
        maxResponseSentences: 2
    }
};
