interface YMapInstance {
  addChild(child: unknown): void
  removeChild(child: unknown): void
  update(props: { location: { center: number[]; zoom: number } }): void
  destroy(): void
}

interface YMapMarkerInstance {
  element: HTMLElement
}

interface YMapClustererFeature {
  type: "Feature"
  id: string
  geometry: { type: "Point"; coordinates: number[] }
  properties?: Record<string, unknown>
}

interface YMapClustererInstance {
  update(props: { features?: YMapClustererFeature[] }): void
}

interface Window {
  ym: (counterId: number, action: string, goalName: string, params?: Record<string, unknown>) => void
  ymaps3?: {
    ready: Promise<void>
    import: (name: string) => Promise<unknown>
    YMap: new (
      el: HTMLElement,
      props: { location: { center: number[]; zoom: number } }
    ) => YMapInstance
    YMapDefaultSchemeLayer: new () => unknown
    YMapDefaultFeaturesLayer: new () => unknown
    YMapMarker: new (
      props: { coordinates: number[]; onClick?: () => void },
      element?: HTMLElement
    ) => YMapMarkerInstance
  }
}
