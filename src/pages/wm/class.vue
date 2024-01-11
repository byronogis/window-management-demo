<script setup lang="ts">
import type {
  StyleValue,
} from 'vue'
import MatrixClass from './wm.class'

const screenDetails = ref<ScreenDetails>()
const getScreenDetailsByHand = ref<boolean>(false)
async function getScreenDetails() {
  if (!('getScreenDetails' in window)) {
    console.warn('Window management not supported')
    return
  }

  try {
    const permissionRes = await navigator.permissions.query({ name: 'window-management' } as any)
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

// data
const dataIds = ref(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'])

const matrix = ref<MatrixClass | null>(null)
watch(() => screenDetails.value, () => {
  if (!screenDetails.value)
    return

  matrix.value = new MatrixClass(screenDetails.value, {
    closeSticky: true,
  })
})

// select
const selectedScreenIds = ref<string[]>([])
function selectScreen(screenId: string, e: PointerEvent) {
  if (e.ctrlKey) {
    if (selectedScreenIds.value.includes(screenId))
      selectedScreenIds.value.splice(selectedScreenIds.value.indexOf(screenId), 1)

    else
      selectedScreenIds.value.push(screenId)

    return
  }
  selectedScreenIds.value = []
  selectedScreenIds.value.push(screenId)
}

// screens wrapper scale (auto scale to contail all screen)
const screensWrapperScaleRef = ref<HTMLElement>()
const screensWrapperScaleStyle = ref<StyleValue>()
watch(() => matrix.value?.map, () => {
  if (!matrix.value?.map)
    return

  if (!screensWrapperScaleRef.value)
    return

  screensWrapperScaleStyle.value = matrix.value.getContentStyle(screensWrapperScaleRef.value)
})

// actions
const splitTemplate = ref<[number, number]>([1, 1]) // [row, col]
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

          // handleStopCarousel()
          matrix.value?.split(splitTemplate.value, selectedScreenIds.value)
        },
      },
      // Launch
      {
        text: 'Launch',
        // let screen open a new browser window and fullscreen
        handler: () => {
          // handleStopCarousel()
          // handleLaunch()
          matrix.value?.launch('/wm')
        },
      },
      {
        text: 'Close All',
        handler: () => {
          // handleStopCarousel()
          matrix.value?.removeAllWindow()
        },
      },
      // Carousel
      {
        text: 'Carousel',
        handler: () => {
          // handleStopCarousel()
          // handleCarousel(carouselMs.value)
          matrix.value?.startPoll(dataIds.value, 3000)
        },

      },
      {
        text: 'Stop Carousel',
        handler: () => {
          // handleStopCarousel()
          matrix.value?.stopPoll()
        },
      },
    ])
</script>

<template>
  <div>
    <button v-if="getScreenDetailsByHand" @click="getScreenDetails">
      Get Screens
    </button>

    <main v-else>
      <section class="flex flex-row items-center justify-center">
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

        <i
          class="inline-block h-4 w-4 rounded-4 leading-none"
          :class="matrix?.polling ? 'bg-green-500' : 'bg-red-500'"
        />
      </section>

      <section
        class="screens-wrapper relative my-20 h-600px w-full bg-gray-200"
        style=""
        @click.self="selectedScreenIds = []"
      >
        <div
          ref="screensWrapperScaleRef"
          class="screens-wrapper__scale relative"
          :style="screensWrapperScaleStyle"
        >
          <div
            v-for="(screen, screenIndex) in matrix?.map.values()"
            :key="screen.matrixId"
            class="absolute border-8 border-gray-400 bg-gray-100"
            :class="{
              'border-red-500': selectedScreenIds.includes(screen.matrixId),
            }"
            :style="{
              top: `${screen.fixingTop}px`,
              left: `${screen.fixingLeft}px`,
              width: `${screen.width}px`,
              height: `${screen.height}px`,
            }"
            @click="selectScreen(screen.matrixId, $event)"
          >
            <!-- screenId -->
            <!-- <span class="absolute left-0 top-0 p-4 opacity-60 hover:opacity-100">{{ screen._screenId }}</span> -->

            <!-- windows -->
            <div
              class="windows-wrapper grid h-full w-full"
              :style="{
                'grid-template-columns': `repeat(${screen.grid.template[1]}, 1fr)`,
                'grid-template-rows': `repeat(${screen.grid.template[0]}, 1fr)`,
              }"
            >
              <div
                v-for="(window) in screen.grid.list"
                :key="window.gridId"
                class="h-full w-full border-2 border-gray-400 bg-teal-200"
              >
                <span>{{ screenIndex + 1 }}-{{ window.gridId }}</span>
                <br>
                <span>camera: {{ window.dataId || 'null' }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped lang="postcss"></style>
