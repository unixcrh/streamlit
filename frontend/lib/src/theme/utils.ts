/**
 * Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { getLuminance } from "color2k"
import camelcase from "camelcase"
import decamelize from "decamelize"
import cloneDeep from "lodash/cloneDeep"
import merge from "lodash/merge"

import {
  CustomThemeConfig,
  ICustomThemeConfig,
} from "@streamlit/lib/src/proto"
import { logError } from "@streamlit/lib/src/util/log"
import {
  LocalStore,
  localStorageAvailable,
} from "@streamlit/lib/src/util/storageUtils"
import {
  baseTheme,
  CachedTheme,
  darkTheme,
  lightTheme,
  EmotionTheme,
  ThemeConfig,
  ThemeSpacing,
} from "@streamlit/lib/src/theme"

import { fonts } from "./primitives/typography"
import {
  computeDerivedColors,
  createEmotionColors,
  DerivedColors,
} from "./getColors"
import { createBaseUiTheme } from "./createThemeUtil"

export const AUTO_THEME_NAME = "Use system setting"
export const CUSTOM_THEME_NAME = "Custom Theme"

export const getSystemTheme = (): ThemeConfig => {
  return window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? darkTheme
    : lightTheme
}

export const createAutoTheme = (): ThemeConfig => ({
  ...getSystemTheme(),
  name: AUTO_THEME_NAME,
})

// Update auto theme in case it has changed
export const createPresetThemes = (): ThemeConfig[] => [
  createAutoTheme(),
  lightTheme,
  darkTheme,
]

export const isPresetTheme = (themeConfig: ThemeConfig): boolean => {
  const presetThemeNames = createPresetThemes().map((t: ThemeConfig) => t.name)
  return presetThemeNames.includes(themeConfig.name)
}

export const fontToEnum = (font: string): CustomThemeConfig.FontFamily => {
  const fontStyle = Object.keys(fonts).find(
    (fontType: string) => fonts[fontType] === font
  )
  const defaultFont = CustomThemeConfig.FontFamily.SANS_SERIF
  if (fontStyle) {
    const parsedFontStyle = decamelize(fontStyle).toUpperCase()
    return parsedFontStyle in CustomThemeConfig.FontFamily
      ? // @ts-expect-error
        CustomThemeConfig.FontFamily[parsedFontStyle]
      : defaultFont
  }
  return defaultFont
}

export const fontEnumToString = (
  font: CustomThemeConfig.FontFamily | null | undefined
): string | undefined =>
  font !== null &&
  font !== undefined && // font can be 0 for sans serif
  font in CustomThemeConfig.FontFamily
    ? fonts[
        camelcase(
          CustomThemeConfig.FontFamily[font].toString()
        ) as keyof typeof fonts
      ]
    : undefined

export const bgColorToBaseString = (bgColor?: string): string =>
  bgColor === undefined || getLuminance(bgColor) > 0.5 ? "light" : "dark"

export const isColor = (strColor: string): boolean => {
  const s = new Option().style
  s.color = strColor
  return s.color !== ""
}

export const createEmotionTheme = (
  themeInput: Partial<ICustomThemeConfig>,
  baseThemeConfig = baseTheme
): EmotionTheme => {
  const { genericColors, genericFonts } = baseThemeConfig.emotion
  const { font, radii, fontSizes, ...customColors } = themeInput

  const parsedFont = fontEnumToString(font)

  const parsedColors = Object.entries(customColors).reduce(
    (colors: Record<string, string>, [key, color]) => {
      // @ts-expect-error
      if (isColor(color)) {
        // @ts-expect-error
        colors[key] = color
      } else if (isColor(`#${color}`)) {
        colors[key] = `#${color}`
      }
      return colors
    },
    {}
  )

  // TODO: create an enum for this. Updating everything if a
  // config option changes is a pain
  // Mapping from CustomThemeConfig to color primitives
  const {
    secondaryBackgroundColor: secondaryBg,
    backgroundColor: bgColor,
    primaryColor: primary,
    textColor: bodyText,
    widgetBackgroundColor: widgetBackgroundColor,
    widgetBorderColor: widgetBorderColor,
  } = parsedColors

  const newGenericColors = { ...genericColors }

  if (primary) newGenericColors.primary = primary
  if (bodyText) newGenericColors.bodyText = bodyText
  if (secondaryBg) newGenericColors.secondaryBg = secondaryBg
  if (bgColor) newGenericColors.bgColor = bgColor
  if (widgetBackgroundColor)
    newGenericColors.widgetBackgroundColor = widgetBackgroundColor
  if (widgetBorderColor) newGenericColors.widgetBorderColor = widgetBorderColor

  const conditionalOverrides: any = {}

  if (radii) {
    conditionalOverrides.radii = {
      ...baseThemeConfig.emotion.radii,
    }

    if (radii.checkboxRadius)
      conditionalOverrides.radii.sm = addPxUnit(radii.checkboxRadius)
    if (radii.baseWidgetRadius)
      conditionalOverrides.radii.md = addPxUnit(radii.baseWidgetRadius)
  }

  if (fontSizes) {
    conditionalOverrides.fontSizes = {
      ...baseThemeConfig.emotion.fontSizes,
    }

    if (fontSizes.tinyFontSize) {
      conditionalOverrides.fontSizes.twoSm = addPxUnit(fontSizes.tinyFontSize)
      conditionalOverrides.fontSizes.twoSmPx = fontSizes.tinyFontSize
    }

    if (fontSizes.smallFontSize) {
      conditionalOverrides.fontSizes.sm = addPxUnit(fontSizes.smallFontSize)
      conditionalOverrides.fontSizes.smPx = fontSizes.smallFontSize
    }

    if (fontSizes.baseFontSize) {
      conditionalOverrides.fontSizes.md = addPxUnit(fontSizes.baseFontSize)
      conditionalOverrides.fontSizes.mdPx = fontSizes.baseFontSize
    }
  }

  return {
    ...baseThemeConfig.emotion,
    colors: createEmotionColors(newGenericColors),
    genericColors: newGenericColors,
    genericFonts: {
      ...genericFonts,
      ...(parsedFont && {
        bodyFont: themeInput.bodyFont ? themeInput.bodyFont : parsedFont,
        headingFont: themeInput.bodyFont ? themeInput.bodyFont : parsedFont,
        codeFont: themeInput.codeFont
          ? themeInput.codeFont
          : genericFonts.codeFont,
      }),
    },
    ...conditionalOverrides,
  }
}

export const toThemeInput = (
  theme: EmotionTheme
): Partial<CustomThemeConfig> => {
  const { colors, genericFonts } = theme
  return {
    primaryColor: colors.primary,
    backgroundColor: colors.bgColor,
    secondaryBackgroundColor: colors.secondaryBg,
    textColor: colors.bodyText,
    font: fontToEnum(genericFonts.bodyFont),
  }
}

export type ExportedTheme = {
  base: string
  primaryColor: string
  backgroundColor: string
  secondaryBackgroundColor: string
  textColor: string
  font: string
} & DerivedColors

export const toExportedTheme = (theme: EmotionTheme): ExportedTheme => {
  const { genericColors } = theme
  const themeInput = toThemeInput(theme)

  // At this point, we know that all of the fields of themeInput are populated
  // (since we went "backwards" from a theme -> themeInput), but typescript
  // doesn't know this, so we have to cast each field to string.
  return {
    primaryColor: themeInput.primaryColor as string,
    backgroundColor: themeInput.backgroundColor as string,
    secondaryBackgroundColor: themeInput.secondaryBackgroundColor as string,
    textColor: themeInput.textColor as string,

    base: bgColorToBaseString(themeInput.backgroundColor),
    font: fontEnumToString(themeInput.font) as string,

    ...computeDerivedColors(genericColors),
  }
}

const completeThemeInput = (
  partialInput: Partial<CustomThemeConfig>,
  baseTheme: ThemeConfig
): CustomThemeConfig => {
  return new CustomThemeConfig({
    ...toThemeInput(baseTheme.emotion),
    ...partialInput,
  })
}

export const createTheme = (
  themeName: string,
  themeInput: Partial<CustomThemeConfig>,
  baseThemeConfig?: ThemeConfig,
  inSidebar = false
): ThemeConfig => {
  if (baseThemeConfig) {
    themeInput = completeThemeInput(themeInput, baseThemeConfig)
  } else if (themeInput.base === CustomThemeConfig.BaseTheme.DARK) {
    themeInput = completeThemeInput(themeInput, darkTheme)
  } else {
    themeInput = completeThemeInput(themeInput, lightTheme)
  }

  // We use startingTheme to pick a set of "auxiliary colors" for widgets like
  // the success/info/warning/error boxes and others; these need to have their
  // colors tweaked to work well with the background.
  //
  // For our auxiliary colors, we pick colors that look reasonable based on the
  // theme's backgroundColor instead of picking them using themeInput.base.
  // This way, things will look good even if a user sets
  // themeInput.base === LIGHT and themeInput.backgroundColor === "black".
  const bgColor = themeInput.backgroundColor as string
  const startingTheme = merge(
    cloneDeep(
      baseThemeConfig
        ? baseThemeConfig
        : getLuminance(bgColor) > 0.5
        ? lightTheme
        : darkTheme
    ),
    { emotion: { inSidebar } }
  )

  const emotion = createEmotionTheme(themeInput, startingTheme)

  return {
    ...startingTheme,
    name: themeName,
    emotion,
    basewebTheme: createBaseUiTheme(emotion, startingTheme.primitives),
  }
}

export const getCachedTheme = (): ThemeConfig | null => {
  if (!localStorageAvailable()) {
    return null
  }

  const cachedThemeStr = window.localStorage.getItem(LocalStore.ACTIVE_THEME)
  if (!cachedThemeStr) {
    return null
  }

  const { name: themeName, themeInput }: CachedTheme =
    JSON.parse(cachedThemeStr)
  switch (themeName) {
    case lightTheme.name:
      return lightTheme
    case darkTheme.name:
      return darkTheme
    default:
      // At this point we're guaranteed that themeInput is defined.
      return createTheme(themeName, themeInput as Partial<CustomThemeConfig>)
  }
}

const deleteOldCachedThemes = (): void => {
  const { CACHED_THEME_VERSION, CACHED_THEME_BASE_KEY } = LocalStore
  const { localStorage } = window

  // Pre-release versions of theming stored cached themes under the key
  // "stActiveTheme".
  localStorage.removeItem("stActiveTheme")

  // The first version of cached themes had keys of the form
  // `stActiveTheme-${window.location.pathname}` with no version number.
  localStorage.removeItem(CACHED_THEME_BASE_KEY)

  for (let i = 1; i < CACHED_THEME_VERSION; i++) {
    localStorage.removeItem(
      `${CACHED_THEME_BASE_KEY}-v${CACHED_THEME_VERSION}`
    )
  }
}

export const setCachedTheme = (themeConfig: ThemeConfig): void => {
  if (!localStorageAvailable()) {
    return
  }

  deleteOldCachedThemes()

  const cachedTheme: CachedTheme = {
    name: themeConfig.name,
    ...(!isPresetTheme(themeConfig) && {
      themeInput: toThemeInput(themeConfig.emotion),
    }),
  }

  window.localStorage.setItem(
    LocalStore.ACTIVE_THEME,
    JSON.stringify(cachedTheme)
  )
}

export const removeCachedTheme = (): void => {
  if (!localStorageAvailable()) {
    return
  }

  window.localStorage.removeItem(LocalStore.ACTIVE_THEME)
}

export const getDefaultTheme = (): ThemeConfig => {
  // Priority for default theme
  // 1. Previous user preference
  // 2. OS preference
  // If local storage has Auto, refetch system theme as it may have changed
  // based on time of day. We shouldn't ever have this saved in our storage
  // but checking in case!
  const cachedTheme = getCachedTheme()
  return cachedTheme && cachedTheme.name !== AUTO_THEME_NAME
    ? cachedTheme
    : createAutoTheme()
}

const whiteSpace = /\s+/
export function computeSpacingStyle(
  value: string,
  theme: EmotionTheme
): string {
  if (value === "") {
    return ""
  }

  return value
    .split(whiteSpace)
    .map(marginValue => {
      if (marginValue === "0") {
        return theme.spacing.none
      }

      if (!(marginValue in theme.spacing)) {
        logError(`Invalid spacing value: ${marginValue}`)
        return theme.spacing.none
      }

      return theme.spacing[marginValue as ThemeSpacing]
    })
    .join(" ")
}

export function hasLightBackgroundColor(theme: EmotionTheme): boolean {
  return getLuminance(theme.colors.bgColor) > 0.5
}

export function getGray70(theme: EmotionTheme): string {
  return hasLightBackgroundColor(theme)
    ? theme.colors.gray70
    : theme.colors.gray30
}

export function getGray30(theme: EmotionTheme): string {
  return hasLightBackgroundColor(theme)
    ? theme.colors.gray30
    : theme.colors.gray85
}

export function getGray90(theme: EmotionTheme): string {
  return hasLightBackgroundColor(theme)
    ? theme.colors.gray90
    : theme.colors.gray10
}

export function getMdRed(theme: EmotionTheme): string {
  return hasLightBackgroundColor(theme)
    ? theme.colors.red80
    : theme.colors.red70
}

export function getMdBlue(theme: EmotionTheme): string {
  return hasLightBackgroundColor(theme)
    ? theme.colors.blue80
    : theme.colors.blue50
}

export function getMdGreen(theme: EmotionTheme): string {
  return hasLightBackgroundColor(theme)
    ? theme.colors.green90
    : theme.colors.green60
}

export function getMdViolet(theme: EmotionTheme): string {
  return hasLightBackgroundColor(theme)
    ? theme.colors.purple80
    : theme.colors.purple50
}

export function getMdOrange(theme: EmotionTheme): string {
  return hasLightBackgroundColor(theme)
    ? theme.colors.orange100
    : theme.colors.orange60
}

function getBlueArrayAsc(theme: EmotionTheme): string[] {
  const { colors } = theme
  return [
    colors.blue10,
    colors.blue20,
    colors.blue30,
    colors.blue40,
    colors.blue50,
    colors.blue60,
    colors.blue70,
    colors.blue80,
    colors.blue90,
    colors.blue100,
  ]
}

function getBlueArrayDesc(theme: EmotionTheme): string[] {
  const { colors } = theme
  return [
    colors.blue100,
    colors.blue90,
    colors.blue80,
    colors.blue70,
    colors.blue60,
    colors.blue50,
    colors.blue40,
    colors.blue30,
    colors.blue20,
    colors.blue10,
  ]
}

export function getSequentialColorsArray(theme: EmotionTheme): string[] {
  return hasLightBackgroundColor(theme)
    ? getBlueArrayAsc(theme)
    : getBlueArrayDesc(theme)
}

export function getDivergingColorsArray(theme: EmotionTheme): string[] {
  const { colors } = theme
  return [
    colors.red100,
    colors.red90,
    colors.red70,
    colors.red50,
    colors.red30,
    colors.blue30,
    colors.blue50,
    colors.blue70,
    colors.blue90,
    colors.blue100,
  ]
}

export function getCategoricalColorsArray(theme: EmotionTheme): string[] {
  const { colors } = theme
  return hasLightBackgroundColor(theme)
    ? [
        colors.blue80,
        colors.blue40,
        colors.red80,
        colors.red40,
        colors.blueGreen80,
        colors.green40,
        colors.orange80,
        colors.orange50,
        colors.purple80,
        colors.gray40,
      ]
    : [
        colors.blue40,
        colors.blue80,
        colors.red40,
        colors.red80,
        colors.green40,
        colors.blueGreen80,
        colors.orange50,
        colors.orange80,
        colors.purple80,
        colors.gray40,
      ]
}

export function getDecreasingRed(theme: EmotionTheme): string {
  return hasLightBackgroundColor(theme)
    ? theme.colors.red80
    : theme.colors.red40
}

export function getIncreasingGreen(theme: EmotionTheme): string {
  return hasLightBackgroundColor(theme)
    ? theme.colors.blueGreen80
    : theme.colors.green40
}

function addPxUnit(n: number): string {
  return `${n}px`
}
