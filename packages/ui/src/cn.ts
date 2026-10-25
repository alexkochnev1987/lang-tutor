import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * R5: слияние классов только через это.
 * Без tailwind-merge «px-4» + «px-6» разрешается по порядку в CSS,
 * а не по порядку в пропсах — результат непредсказуем.
 */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))
