import type {
  Screen,
  Window,
  WindowTemplate,
} from './wm.types'

export function generateScreenId(screen: ScreenDetailed | Screen) {
  const left = `${screen.left ?? screen!._left}`
  const top = `${screen.top ?? screen!._top}`
  const width = `${screen.width ?? screen!._width}`
  const height = `${screen.height ?? screen!._height}`

  return `l=${left},t=${top},w=${width},h=${height}`
}

export function generalWindowsFromTemplate(template: WindowTemplate, screen: Screen) {
  if (!template[0] || !template[1])
    return []

  const windows: Window[] = []

  for (let i = 0; i < template[0] * template[1]; i++) {
    windows.push({
      windowIdLong: `${generateScreenId(screen)},window=${i + 1}`,
      windowId: `${i + 1}`,
      cameraId: '',
    })
  }

  return windows
}

// function generalWinowStyles(template: WindowTemplate, currentWindowIndex: number, screen: Screen) {
//   const windowWidth = screen.width / template[0]
//   const windowHeight = screen.height / template[1]
//   const windowLeft = (currentWindowIndex % template[0]) * windowWidth
//   const windowTop = Math.floor(currentWindowIndex / template[0]) * windowHeight

//   return {
//     width: windowWidth,
//     height: windowHeight,
//     left: windowLeft,
//     top: windowTop,
//   }
// }
