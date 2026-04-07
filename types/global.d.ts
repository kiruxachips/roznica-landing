interface YMapInstance {
  addChild(child: unknown): void
  removeChild(child: unknown): void
  update(props: { location: { center: number[]; zoom: number } }): void
  destroy(): void
}

interface YMapMarkerInstance {
  element: HTMLElement
}

interface Window {
  ym: (counterId: number, action: string, goalName: string, params?: Record<string, unknown>) => void
  ymaps3?: {
    ready: Promise<void>
    YMap: new (
      el: HTMLElement,
      props: { location: { center: number[]; zoom: number } }
    ) => YMapInstance
    YMapDefaultSchemeLayer: new () => unknown
    YMapDefaultFeaturesLayer: new () => unknown
    YMapMarker: new (props: { coordinates: number[]; onClick?: () => void }) => YMapMarkerInstance
  }
}
