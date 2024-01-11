interface MatrixType {
  height: number
  width: number
  left: number
  top: number
  availHeight: number
  availWidth: number
  availLeft: number
  availTop: number
  fixingLeft: number
  fixingTop: number
  isExtended: boolean
  isInternal: boolean
  isPrimary: boolean
  matrixId: MatrixId
  grid: {
    template: [number, number]
    list: Grid[]
  }
}

interface Grid {
  gridId: string
  gridIdLong: string
  dataId: string
}

export type MatrixId = string

export type GridTemplate = [number, number]

interface MatrixOptions {
  includePrimary?: boolean
  storageKey?: string
  closeSticky?: boolean
}

export default class MatrixClass {
  map: Map<MatrixId, MatrixType> = new Map<MatrixId, MatrixType>()
  options: Required<MatrixOptions> = {
    includePrimary: false,
    storageKey: 'matrix',
    closeSticky: false,
  }

  polling: boolean = false
  pollIntervalId: NodeJS.Timer | undefined = undefined
  openedWindowMap: Map<string, Window> = new Map<string, Window>()
  openedWindowMonitorIntervalId: NodeJS.Timer | undefined = undefined

  constructor(screenDetails: ScreenDetails, options?: MatrixOptions) {
    this.map = MatrixClass.transform2Matrix(screenDetails.screens)
    this.options = {
      ...this.options,
      ...options,
    }
  }

  split(template: GridTemplate, matrixIds: string[]) {
    this.map.forEach((matrix, matrixId) => {
      if (matrixIds.includes(matrixId)) {
        matrix.grid.template = [...template]
        matrix.grid.list = []
        for (let i = 0; i < template[0] * template[1]; i++) {
          matrix.grid.list.push({
            gridId: `${i + 1}`,
            gridIdLong: MatrixClass.generateGridId(matrixId, i + 1),
            dataId: '',
          })
        }
      }
    })
  }

  startPoll(dataIdList: string[], pollingInterval = 5000) {
    this.polling = true

    const gridList = this.getGridList()

    // 计算设备和格子的总数
    const totalDatas = dataIdList.length
    const totalGrids = gridList.length

    // 启动轮询任务
    let currentDataIndex = 0
    const intervalFn = () => {
      // 如果设备数量少于或等于格子数量，一次性分配完毕，停止轮询
      if (totalDatas <= totalGrids) {
        gridList.forEach((grid, index) => {
          grid.dataId = dataIdList[index] ? dataIdList[index] : ''
        })

        console.log('Polling stopped. All devices are assigned.')
        clearInterval(this.pollIntervalId)
        return
      }

      // 计算当前轮询的设备范围
      const startIdx = currentDataIndex
      const endIdx = currentDataIndex + totalGrids

      // 获取当前轮询的设备
      const currentBatchDatas = dataIdList.slice(startIdx, endIdx)

      // 更新格子状态
      gridList.forEach((grid, index) => {
        grid.dataId = currentBatchDatas[index] ? currentBatchDatas[index] : ''
      })

      // 更新存储
      this.setStorage()

      // 输出当前轮询的结果
      console.log(`Batch currentBatchDatas`, currentBatchDatas)

      // 增加设备索引，如果达到设备列表末尾，重新开始
      currentDataIndex += totalGrids
      if (currentDataIndex >= totalDatas)
        currentDataIndex = 0
    }
    intervalFn()
    this.pollIntervalId = setInterval(intervalFn, pollingInterval)
  }

  stopPoll() {
    this.polling = false
    clearInterval(this.pollIntervalId)
  }

  launch(url: string) {
    this.setStorage()

    this.map.forEach(async (matrix, matrixId) => {
      const features = [
        `height=${matrix.height}`,
        `width=${matrix.width}`,
        `left=${matrix.left}`,
        `top=${matrix.top}`,
        `fullscreen`,
      ].join(',')

      const win = window.open(url, matrixId, features)
      win?.document.documentElement.requestFullscreen()
      // win?.addEventListener('unload', (e) => {
      //   //
      // })
      win && this.openedWindowMap.set(matrixId, win)
    })

    this.startOpenedWindowMonitor()
  }

  startOpenedWindowMonitor() {
    this.openedWindowMonitorIntervalId = setInterval(() => {
      if (this.openedWindowMap.size === 0) {
        clearInterval(this.openedWindowMonitorIntervalId)
        return
      }

      this.openedWindowMap.forEach((win, matrixId) => {
        if (win.closed) {
          this.options.closeSticky
            ? this.removeAllWindow()
            : this.removeWindow(matrixId)
        }
      })
    }, 200)
  }

  removeWindow(matrixId: string) {
    const win = this.openedWindowMap.get(matrixId)
    win?.close()
    this.openedWindowMap.delete(matrixId)
  }

  removeAllWindow() {
    this.openedWindowMap.forEach(win => win.close())
    this.openedWindowMap.clear()
  }

  static transform2Matrix(screens: ScreenDetailed[]): Map<MatrixId, MatrixType> {
    /**
     * 总是以主屏幕为原点，所以需要考虑主屏幕左侧和顶部的偏移量
     */
    const minLeft = Math.min(...screens.map(({ left }) => left))
    const minTop = Math.min(...screens.map(({ top }) => top))

    return screens.reduce((map, screen) => {
      const matrixId = MatrixClass.generateMatrixId(screen)
      map.set(MatrixClass.generateMatrixId(screen), {
        height: screen.height,
        width: screen.width,
        left: screen.left,
        top: screen.top,
        availHeight: screen.availHeight,
        availWidth: screen.availWidth,
        availLeft: screen.availLeft,
        availTop: screen.availTop,
        fixingLeft: screen.left - minLeft,
        fixingTop: screen.top - minTop,
        isExtended: screen.isExtended,
        isInternal: screen.isInternal,
        isPrimary: screen.isPrimary,
        matrixId,
        grid: {
          template: [1, 1],
          list: [{
            gridId: '1',
            gridIdLong: MatrixClass.generateGridId(matrixId, 1),
            dataId: '',
          }],
        },
      })
      return map
    }, new Map<MatrixId, MatrixType>())
  }

  static generateMatrixId(screen: ScreenDetailed | MatrixType) {
    const { left, top, width, height } = screen
    return `l=${left},t=${top},w=${width},h=${height}`
  }

  static generateGridId(matrixId: string, gridIndex: number) {
    return `${matrixId},grid=${gridIndex}`
  }

  getGridList() {
    return Array.from(this.map.values()).reduce((acc, cur) => {
      return [...acc, ...cur.grid.list]
    }, [] as Grid[])
  }

  getGridMap() {
    return this.getGridList().reduce((map, grid) => {
      map.set(grid.gridIdLong, grid)
      return map
    }, new Map<string, Grid>())
  }

  getContentStyle(el: HTMLElement | string) {
    if (typeof el === 'string')
      el = document.querySelector(el) as HTMLElement

    if (!el)
      return {}

    const matrixList = Array.from(this.map.values())
    const offsetWidth = Math.max(...matrixList.map(matrix => matrix.fixingLeft + matrix.width))
    const offsetHeight = Math.max(...matrixList.map(matrix => matrix.fixingTop + matrix.height))

    const contentWidth = offsetWidth
    const contentHeight = offsetHeight

    const wrapper = el.parentElement as HTMLElement
    if (!wrapper)
      return {}

    const wrapperWidth = wrapper.offsetWidth
    const wrapperHeight = wrapper.offsetHeight

    const contentScaleWidth = wrapperWidth / contentWidth
    const contentScaleHeight = wrapperHeight / contentHeight
    const contentScale = Math.min(contentScaleWidth, contentScaleHeight)

    return {
      transform: `scale(${contentScale})`,
      transformOrigin: 'top left',
      fontSize: `${1 / contentScale * 100}%`,
    }
  }

  setStorage() {
    localStorage.setItem(
      this.options.storageKey,
      JSON.stringify(Object.fromEntries(this.getGridMap().entries())),
    )
  }

  getStorage() {
    const storage = localStorage.getItem(this.options.storageKey)
    return storage ? JSON.parse(storage) : {}
  }

  clearStorage() {
    localStorage.removeItem(this.options.storageKey)
  }
}
