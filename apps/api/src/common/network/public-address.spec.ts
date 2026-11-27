import { isPrivateAddress } from "./public-address"

describe("isPrivateAddress", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "172.20.1.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "::1",
    "::",
    "fd00::1",
    "fe80::1",
    "::ffff:10.0.0.1",
    "::ffff:7f00:1",
    "::ffff:a9fe:a9fe",
    "::127.0.0.1",
    "::a9fe:a9fe",
    "64:ff9b::a9fe:a9fe",
    "64:ff9b:1::a00:1",
    "2002:7f00:1::",
    "2002:a9fe:a9fe::1",
    "2001:0:4136:e378:8000:63bf:3fff:fdd2",
    "fec0::1",
    "ff02::1",
    "fe80::1%eth0",
    "192.0.0.170",
    "192.88.99.1",
    "198.18.0.1",
    "224.0.0.1",
    "255.255.255.255",
    "[::1]",
    "not-an-ip",
    "",
  ])("treats %s as private", (address) => {
    expect(isPrivateAddress(address)).toBe(true)
  })

  it.each([
    "203.0.113.10",
    "8.8.8.8",
    "2001:db8::1",
    "::ffff:8.8.8.8",
    "2606:4700:4700::1111",
    "2002:808:808::1",
  ])("treats %s as public", (address) => {
    expect(isPrivateAddress(address)).toBe(false)
  })
})
