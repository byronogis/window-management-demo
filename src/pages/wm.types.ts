export interface Screen extends ScreenDetailed {
  _height: number
  _width: number
  _left: number
  _top: number
  _availHeight: number
  _availWidth: number
  _availLeft: number
  _availTop: number
  _isExtended: boolean
  _isInternal: boolean
  _isPrimary: boolean
  _screenId: string
  _windowInfo: {
    template: WindowTemplate
    windowList: Window[]
  }
}

export interface Window {
  windowIdLong: string
  windowId: string
  cameraId: string
}

export type WindowTemplate = [number, number]

export interface Camera {
  cameraId: string
  groupId: string
  kind: string
  label: string
}
