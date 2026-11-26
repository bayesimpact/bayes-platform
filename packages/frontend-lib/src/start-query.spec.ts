import { QueryClient } from "@tanstack/react-query"
import { describe, expect, it, vi } from "vitest"
import { loaderStaleTime, startQuery } from "./start-query"

describe("startQuery", () => {
  it("fills the cache the way the loaders read it", async () => {
    const queryClient = new QueryClient()
    const queryFn = vi.fn(async () => "history")

    startQuery(queryClient, { queryKey: ["history"], queryFn })

    await vi.waitFor(() => expect(queryClient.getQueryData(["history"])).toBe("history"))
    // A second start reads the cache, as `loaderStaleTime` keeps it until an invalidation.
    startQuery(queryClient, { queryKey: ["history"], queryFn })
    expect(queryFn).toHaveBeenCalledTimes(1)
  })

  it("leaves a failure to the section that reads the query, and throws nothing", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const unhandledRejection = vi.fn()
    process.on("unhandledRejection", unhandledRejection)

    expect(() =>
      startQuery(queryClient, {
        queryKey: ["history"],
        queryFn: async () => {
          throw new Error("The history is unreachable")
        },
      }),
    ).not.toThrow()

    await vi.waitFor(() => expect(queryClient.getQueryState(["history"])?.status).toBe("error"))
    // Rejections surface on the next turn of the event loop.
    await new Promise((resolve) => setTimeout(resolve, 0))
    process.off("unhandledRejection", unhandledRejection)
    expect(unhandledRejection).not.toHaveBeenCalled()
  })
})

describe("loaderStaleTime", () => {
  it("reads the cached data, unless a mutation invalidated it", async () => {
    const queryClient = new QueryClient()
    const queryFn = vi.fn(async () => "fresh")
    const options = { queryKey: ["documents"], queryFn, staleTime: loaderStaleTime }
    queryClient.setQueryData(["documents"], "cached")

    expect(await queryClient.query(options)).toBe("cached")
    expect(queryFn).not.toHaveBeenCalled()

    // No component observes the query: the invalidation alone refetches nothing.
    await queryClient.invalidateQueries({ queryKey: ["documents"] })
    expect(await queryClient.query(options)).toBe("fresh")
    expect(queryFn).toHaveBeenCalledTimes(1)
    expect(await queryClient.query(options)).toBe("fresh")
    expect(queryFn).toHaveBeenCalledTimes(1)
  })
})
