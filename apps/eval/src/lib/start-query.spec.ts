import { QueryClient } from "@tanstack/react-query"
import { describe, expect, it, vi } from "vitest"
import { loaderStaleTime } from "./start-query"

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
