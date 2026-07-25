/**
 * Entry-point wrapper. Prints a readable message instead of a stack trace —
 * most people running this are not JavaScript developers.
 */
export async function main(fn) {
  try {
    await fn()
  } catch (err) {
    console.error(`\n${err.message}\n`)
    process.exit(1)
  }
}
