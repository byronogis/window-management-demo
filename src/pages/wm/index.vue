<script setup lang="ts">
import {
  generalWindowsFromTemplate,
  generateScreenId,
} from './wm.utils'
import type {
  Camera,
  Window as CustomWindow,
  Screen,
} from './wm.types'
import wmConfig from './wm.config'

// screenDetails
const screenDetails = ref<ScreenDetails>()
const getScreenDetailsByHand = ref(false)

async function getScreenDetails() {
  if (!('getScreenDetails' in window)) {
    console.warn('Window management not supported')
    return
  }

  try {
    const permissionRes = await navigator.permissions.query({ name: 'window-management' })
    if (permissionRes.state === 'denied') {
      console.warn('Window management permission denied')
      return
    }

    screenDetails.value = await window.getScreenDetails()

    getScreenDetailsByHand.value = false
  }
  catch (err) {
    console.warn(err)
    getScreenDetailsByHand.value = true
  }
}
getScreenDetails()

// screenMap
const screenMap = ref<Map<string, Screen>>(new Map())
watch(screenDetails, () => {
  if (!screenDetails.value)
    return

  console.log(screenDetails)

  let validScreens = screenDetails.value.screens
  !wmConfig.includePrimary && (validScreens = validScreens.filter(screen => !screen.isPrimary))

  const newScreenMap = new Map<string, Screen>()
  validScreens.forEach((screen: ScreenDetailed) => {
    newScreenMap.set(generateScreenId(screen), {
      ...screen,
      _height: screen.height,
      _width: screen.width,
      _left: screen.left,
      _top: screen.top,
      _availHeight: screen.availHeight,
      _availWidth: screen.availWidth,
      _availLeft: screen.availLeft,
      _availTop: screen.availTop,
      _isExtended: screen.isExtended,
      _isInternal: screen.isInternal,
      _isPrimary: screen.isPrimary,
      _screenId: generateScreenId(screen),
      _windowInfo: {
        template: [1, 1],
        windowList: [{
          windowIdLong: `${generateScreenId(screen)},window=1`,
          windowId: `1`,
          cameraId: '',
        }],
      },
    })
  })

  screenMap.value = newScreenMap

  console.log(screenMap.value)
  console.log('=========================================')
})

// select
const selectedScreenIds = ref<string[]>([])
function selectScreen(screenId: string) {
  selectedScreenIds.value = []
  selectedScreenIds.value.push(screenId)
}

// screens wrapper scale (auto scale to contail all screen)
const screensWrapperScaleRef = ref<HTMLElement>()
watch(screenMap, () => {
  if (!screenMap.value.size)
    return

  if (!screensWrapperScaleRef.value)
    return

  const screenList = Array.from(screenMap.value.values())
  const offsetWidth = Math.max(...screenList.map(screen => screen._left + screen._width))
  const offsetHeight = Math.max(...screenList.map(screen => screen._top + screen._height))

  const screensWrapperContentWidth = offsetWidth
  const screensWrapperContentHeight = offsetHeight

  const screensWrapper = screensWrapperScaleRef.value.parentElement
  if (!screensWrapper)
    return

  const screensWrapperWidth = screensWrapper.offsetWidth
  const screensWrapperHeight = screensWrapper.offsetHeight

  const screensWrapperScaleWidth = screensWrapperContentWidth / screensWrapperWidth
  const screensWrapperScaleHeight = screensWrapperContentHeight / screensWrapperHeight

  const screensWrapperScale = Math.max(screensWrapperScaleWidth, screensWrapperScaleHeight)

  screensWrapperScaleRef.value.style.transform = `scale(${1 / screensWrapperScale})`
  screensWrapperScaleRef.value.style.transformOrigin = 'top left'
  screensWrapperScaleRef.value.style.fontSize = `${screensWrapperScale * 100}%`
})

// launch
const launchedScreenMap = ref<Map<string, Window>>(new Map())
const launchedWindowObj = computed<Record<string, CustomWindow>>({
  get() { // TODO to Map
    const launchedWindowObj: Record<string, CustomWindow> = {}
    launchedScreenMap.value.forEach((_, screenId) => {
      const screen = screenMap.value.get(screenId)
      if (!screen)
        return

      screen._windowInfo.windowList.forEach((window) => {
        launchedWindowObj[window.windowIdLong] = window
      })
    })

    return launchedWindowObj
  },
  set(newValue) {
    screenMap.value.forEach((screen) => {
      screen._windowInfo.windowList.forEach((window) => {
        window.cameraId = newValue[window.windowIdLong].cameraId
      })
    })
  },
})
function handleLaunch() {
  screenMap.value.forEach(async (screen) => {
    const features = [
      `top=${screen._top}`,
      `left=${screen._left}`,
      `width=${screen._availWidth}`,
      `height=${screen._availHeight}`,
      'fullscreen',
    ].join(',')

    const ctx = window.open(
      '/',
      screen._screenId,
      features,
    )

    // make fullscreen
    ctx?.document.documentElement.requestFullscreen()
    // document.documentElement.requestFullscreen({ screen: screenDetails.value!.screens[1] })

    console.log(ctx)

    if (!ctx)
      return

    launchedScreenMap.value.set(screen._screenId, ctx)
  })
}

// watch(launchedWindowObj, () => {
//   setStorage()
// }, { deep: true })
// function setStorage() {
//   try {
//     useStorage('launchedWindowObj', launchedWindowObj)
//   }
//   catch (err) {
//     console.warn(err)
//   }
// }

// carousel
const carouselIntervalTimer = ref<NodeJS.Timeout>()
const carouselIntervalCount = ref<number>(0)
const carouselMs = ref(2000)
const cameraList = ref<Camera[]>(Array.from({ length: 10 }, (_, index) => ({
  cameraId: `${index}`,
  groupId: '',
  kind: 'videoinput',
  label: `camera-${index}`,
})))
function handleCarousel(ms: number) {
  // camera carousel on each launchedWindow
  const launchedWindowObjLength = Object.keys(launchedWindowObj.value).length
  const preparedCarouselList = pollCameraOnWindow(cameraList.value, launchedWindowObjLength)

  carouselIntervalTimer.value = setInterval(() => {
    const newLaunchedWindowObj = launchedWindowObj.value
    Object.keys(newLaunchedWindowObj).forEach((windowLongId, index) => {
      newLaunchedWindowObj[windowLongId] = {
        ...newLaunchedWindowObj[windowLongId],
        cameraId: preparedCarouselList[carouselIntervalCount.value][index].cameraId,
      }
    })
    launchedWindowObj.value = newLaunchedWindowObj

    carouselIntervalCount.value++
    if (carouselIntervalCount.value >= preparedCarouselList.length)
      carouselIntervalCount.value = 0
  }, ms)
}
function handleStopCarousel() {
  clearInterval(carouselIntervalTimer.value)
}

function pollCameraOnWindow(cameras: Camera[], windowLength: number) {
  const result = []
  for (let i = 0; i < cameras.length; i += windowLength) {
    if (i + windowLength <= cameras.length) {
      result.push(cameras.slice(i, i + windowLength))
    }
    else {
      const temp = Array(windowLength).fill(0)
      const remainingCameras = cameras.slice(i)
      for (let j = 0; j < remainingCameras.length; j++)
        temp[j] = remainingCameras[j]

      result.push(temp)
    }
  }
  return result
}

// actions
const splitTemplate = ref([1, 1]) // [row, col]
const actions = ref<{
  text: string
  handler?: () => void
}[]>([
      // Split
      {
        text: 'Split',
        handler() {
          if (!selectedScreenIds.value.length)
            return

          handleStopCarousel()
          const [row, col] = splitTemplate.value
          selectedScreenIds.value.forEach((screenId) => {
            const screen = screenMap.value.get(screenId)
            if (!screen)
              return

            screen._windowInfo.template = [row, col]
            screen._windowInfo.windowList = generalWindowsFromTemplate([row, col], screen)
          })
        },
      },
      // Launch
      {
        text: 'Launch',
        // let screen open a new browser window and fullscreen
        handler: () => {
          handleStopCarousel()
          handleLaunch()
        },
      },
      // Carousel
      {
        text: 'Carousel',
        handler: () => {
          handleStopCarousel()
          handleCarousel(carouselMs.value)
        },

      },
      {
        text: 'Stop Carousel',
        handler: () => handleStopCarousel(),
      },
    ])
</script>

<template>
  <div>
    <button v-if="getScreenDetailsByHand" @click="getScreenDetails">
      Get Screens
    </button>

    <main v-else>
      <section>
        <input
          v-for="(_, index) in splitTemplate"
          :key="index"
          v-model="splitTemplate[index]"
          type="number"
          class="mr-4 w-10 border-2 border-gray-400 rounded text-center"
        >

        <button
          v-for="(action, index) in actions"
          :key="index"
          class="mr-4 last:mr-0"
          @click="action.handler"
        >
          {{ action.text }}
        </button>
      </section>

      <section
        class="screens-wrapper relative my-20 h-600px w-full bg-gray-200"
        style=""
        @click.self="selectedScreenIds = []"
      >
        <div
          ref="screensWrapperScaleRef"
          class="screens-wrapper__scale relative"
        >
          <div
            v-for="(screen, screenIndex) in screenMap.values()"
            :key="screen._screenId"
            class="absolute border-8 border-gray-400 bg-gray-100"
            :class="{
              'border-red-500': selectedScreenIds.includes(screen._screenId),
            }"
            :style="{
              top: `${screen._top}px`,
              left: `${screen._left}px`,
              width: `${screen._width}px`,
              height: `${screen._height}px`,
            }"
            @click="selectScreen(screen._screenId)"
          >
            <!-- screenId -->
            <!-- <span class="absolute left-0 top-0 p-4 opacity-60 hover:opacity-100">{{ screen._screenId }}</span> -->

            <!-- windows -->
            <div
              class="windows-wrapper grid h-full w-full"
              :style="{
                'grid-template-columns': `repeat(${screen._windowInfo.template[1]}, 1fr)`,
                'grid-template-rows': `repeat(${screen._windowInfo.template[0]}, 1fr)`,
              }"
            >
              <div
                v-for="(window) in screen._windowInfo.windowList"
                :key="window.windowId"
                class="h-full w-full border-2 border-gray-400 bg-teal-200"
              >
                <span>{{ screenIndex + 1 }}-{{ window.windowId }}</span>
                <br>
                <span>camera: {{ window.cameraId || 'null' }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped lang="postcss"></style>
