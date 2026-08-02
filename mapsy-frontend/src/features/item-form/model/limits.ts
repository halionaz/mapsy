/**
 * Mirrors the CHECK constraints in supabase/migrations.
 *
 * Not belt-and-braces: with photos uploading before the row is inserted, a
 * violation is only discovered after every object has been transferred. The
 * user waits through the whole upload, sees "업로드 실패", and retrying fails at
 * exactly the same point. Catching it in the form costs nothing and turns a
 * dead end into a corrected character count.
 *
 * Every number here is a copy of one the database owns, so `limits.test.ts`
 * checks each against the generated constraint definitions — and refuses to let
 * a new ceiling appear in the schema without either a mirror or a written reason
 * for not having one. Names alone were not enough: `price` below drifted while
 * its constraint kept its name.
 */
export const LIMITS = {
  title: 100,
  brand: 100,
  size: 40,
  purchasePlace: 100,
  memo: 2000,
  tagLength: 40,
  tagCount: 20,
  /**
   * Mirrors `items_price_max`. The previous value here was 10,000,000,000 with a
   * comment claiming it sat inside int4 — it does not; int4 stops at
   * 2,147,483,647, so everything between the two passed the form and died at
   * INSERT after the photos had uploaded. It drifted because it was the one
   * limit with no named constraint behind it and therefore nothing asserting it.
   */
  price: 1_000_000_000,
} as const

/**
 * How many photos one item may have — mirrors `item_images_sort_order_range`,
 * whose ceiling is on `sort_order` and so is one less than this.
 *
 * Here rather than beside the picker that enforces it, for the same reason as
 * everything above: it is a copy of a number the database owns, and the test
 * that keeps the copies honest has to be able to read it.
 */
export const MAX_PHOTOS = 5
