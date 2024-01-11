interface Screen extends EventTarget {
  readonly isExtended: boolean

  onchange: ((this: Screen, ev: Event) => any) | null
}

interface Window {
  getScreenDetails(): Promise<ScreenDetails>
}

interface ScreenDetails extends EventTarget {
  readonly screens: ScreenDetailed[]
  readonly currentScreen: ScreenDetailed

  onscreenschange: ((this: ScreenDetails, ev: Event) => any) | null
  oncurrentscreenchange: ((this: ScreenDetails, ev: Event) => any) | null
}

interface ScreenDetailed extends Screen {
  readonly availLeft: number
  readonly availTop: number
  readonly left: number
  readonly top: number
  readonly isPrimary: boolean
  readonly isInternal: boolean
  readonly devicePixelRatio: number
  readonly label: string
}

interface FullscreenOptions {
  screen: ScreenDetailed
}
