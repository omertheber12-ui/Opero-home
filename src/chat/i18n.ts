import type { Language } from "../domain/types.js"

export const labels = {
  en: {
    title: "Opero",
    placeholder: "Give a mission",
    send: "Send",
    take: "Take control",
    handBack: "I'm done",
    end: "End",
    level: "Level",
    language: "Language",
    plan: "Plan",
    screen: "Computer",
  },
  he: {
    title: "אופרה",
    placeholder: "תנו משימה",
    send: "שליחה",
    take: "קחו שליטה",
    handBack: "סיימתי",
    end: "סיום",
    level: "רמה",
    language: "שפה",
    plan: "תוכנית",
    screen: "מחשב",
  },
} as const

export function text(language: Language) {
  return labels[language]
}
