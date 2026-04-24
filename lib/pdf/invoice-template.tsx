import { Document, Page, Text, View, StyleSheet, Font, Image } from "@react-pdf/renderer"
import type {
  InvoiceBuyerSnapshot,
  InvoiceSellerSnapshot,
  InvoiceLineItem,
} from "@/lib/dal/wholesale-invoices"

// Регистрация кириллического шрифта для PDF-рендера. @react-pdf/renderer
// не умеет в Cyrillic «из коробки» — стандартный Helvetica отдаст квадраты.
// Подтягиваем Roboto через встроенный в Next.js /public — он грузится
// один раз при cold-start и кэшируется.
const FONT_URL_REGULAR =
  process.env.PDF_FONT_URL_REGULAR ||
  "https://cdn.jsdelivr.net/npm/@fontsource/roboto@5.0.13/files/roboto-cyrillic-400-normal.woff"
const FONT_URL_BOLD =
  process.env.PDF_FONT_URL_BOLD ||
  "https://cdn.jsdelivr.net/npm/@fontsource/roboto@5.0.13/files/roboto-cyrillic-700-normal.woff"

let fontsRegistered = false
export function ensureFontsRegistered() {
  if (fontsRegistered) return
  Font.register({
    family: "Roboto",
    fonts: [
      { src: FONT_URL_REGULAR },
      { src: FONT_URL_BOLD, fontWeight: "bold" },
    ],
  })
  fontsRegistered = true
}

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 9,
    fontFamily: "Roboto",
    color: "#111",
  },
  header: { marginBottom: 20 },
  h1: { fontSize: 16, fontWeight: "bold", marginBottom: 4 },
  meta: { color: "#555", fontSize: 9 },
  block: {
    borderTop: "1px solid #ddd",
    paddingTop: 10,
    marginTop: 14,
  },
  blockTitle: {
    fontWeight: "bold",
    marginBottom: 4,
    fontSize: 10,
  },
  row: { flexDirection: "row", marginBottom: 2 },
  rowLabel: { width: 120, color: "#555" },
  rowValue: { flex: 1 },
  table: { marginTop: 14 },
  tableRow: {
    flexDirection: "row",
    borderBottom: "1px solid #eee",
    paddingVertical: 6,
  },
  tableHeader: {
    backgroundColor: "#f5f5f5",
    fontWeight: "bold",
    borderBottom: "1px solid #ccc",
  },
  colNum: { width: 24 },
  colName: { flex: 1 },
  colQty: { width: 50, textAlign: "right" },
  colPrice: { width: 70, textAlign: "right" },
  colSum: { width: 80, textAlign: "right" },
  summary: {
    marginTop: 14,
    alignSelf: "flex-end",
    width: 260,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  summaryTotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 6,
    borderTop: "1px solid #333",
    fontWeight: "bold",
    fontSize: 11,
  },
  footer: {
    marginTop: 30,
    fontSize: 8,
    color: "#555",
  },
  signLine: {
    marginTop: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    position: "relative",
  },
  signBox: { width: 180 },
  signUnderline: {
    borderBottom: "1px solid #333",
    height: 18,
  },
  signLabel: { fontSize: 8, marginTop: 2, color: "#555" },
  stamp: {
    position: "absolute",
    right: 10,
    top: -30,
    width: 110,
    height: 110,
    opacity: 0.9,
  },
})

export interface InvoicePDFProps {
  kind: "invoice" | "upd" | "act"
  number: string
  date: Date
  orderNumber: string | null
  buyer: InvoiceBuyerSnapshot
  seller: InvoiceSellerSnapshot
  items: InvoiceLineItem[]
  delivery: {
    carrier: string | null
    type: string | null
    address: string | null
    price: number
  }
  subtotal: number
  discount: number
  total: number
  vatRate: number | null
  vatAmount: number | null
  paymentTerms: string | null
  stampUrl?: string | null
}

function formatRub(v: number): string {
  return `${v.toLocaleString("ru-RU")} ₽`
}

function titleByKind(k: InvoicePDFProps["kind"]) {
  if (k === "invoice") return "Счёт на оплату"
  if (k === "upd") return "Универсальный передаточный документ"
  return "Акт сверки"
}

export function InvoicePDF(props: InvoicePDFProps) {
  ensureFontsRegistered()
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.h1}>
            {titleByKind(props.kind)} № {props.number} от{" "}
            {props.date.toLocaleDateString("ru-RU")}
          </Text>
          {props.orderNumber && (
            <Text style={styles.meta}>По заказу {props.orderNumber}</Text>
          )}
        </View>

        <View style={styles.block}>
          <Text style={styles.blockTitle}>Поставщик</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Организация:</Text>
            <Text style={styles.rowValue}>{props.seller.legalName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>ИНН / КПП:</Text>
            <Text style={styles.rowValue}>
              {props.seller.inn}
              {props.seller.kpp ? ` / ${props.seller.kpp}` : ""}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Адрес:</Text>
            <Text style={styles.rowValue}>{props.seller.legalAddress}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Банк:</Text>
            <Text style={styles.rowValue}>{props.seller.bankName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Расчётный счёт:</Text>
            <Text style={styles.rowValue}>{props.seller.bankAccount}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>БИК / Корр. счёт:</Text>
            <Text style={styles.rowValue}>
              {props.seller.bankBic} / {props.seller.corrAccount}
            </Text>
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockTitle}>Покупатель</Text>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Организация:</Text>
            <Text style={styles.rowValue}>{props.buyer.legalName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>ИНН / КПП:</Text>
            <Text style={styles.rowValue}>
              {props.buyer.inn}
              {props.buyer.kpp ? ` / ${props.buyer.kpp}` : ""}
            </Text>
          </View>
          {props.buyer.legalAddress && (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Адрес:</Text>
              <Text style={styles.rowValue}>{props.buyer.legalAddress}</Text>
            </View>
          )}
        </View>

        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <Text style={styles.colNum}>№</Text>
            <Text style={styles.colName}>Товар</Text>
            <Text style={styles.colQty}>Кол-во</Text>
            <Text style={styles.colPrice}>Цена</Text>
            <Text style={styles.colSum}>Сумма</Text>
          </View>
          {props.items.map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.colNum}>{i + 1}</Text>
              <Text style={styles.colName}>
                {item.name} ({item.weight})
              </Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colPrice}>{formatRub(item.price)}</Text>
              <Text style={styles.colSum}>{formatRub(item.total)}</Text>
            </View>
          ))}
          {props.delivery.price > 0 && (
            <View style={styles.tableRow}>
              <Text style={styles.colNum}>{props.items.length + 1}</Text>
              <Text style={styles.colName}>
                Доставка
                {props.delivery.carrier ? ` (${props.delivery.carrier.toUpperCase()}${props.delivery.type ? ", " + props.delivery.type : ""})` : ""}
                {props.delivery.address ? `, ${props.delivery.address}` : ""}
              </Text>
              <Text style={styles.colQty}>1</Text>
              <Text style={styles.colPrice}>{formatRub(props.delivery.price)}</Text>
              <Text style={styles.colSum}>{formatRub(props.delivery.price)}</Text>
            </View>
          )}
        </View>

        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <Text>Подытог:</Text>
            <Text>{formatRub(props.subtotal)}</Text>
          </View>
          {props.discount > 0 && (
            <View style={styles.summaryRow}>
              <Text>Скидка:</Text>
              <Text>−{formatRub(props.discount)}</Text>
            </View>
          )}
          {props.vatAmount !== null && props.vatRate !== null && (
            <View style={styles.summaryRow}>
              <Text>В т.ч. НДС {props.vatRate}%:</Text>
              <Text>{formatRub(props.vatAmount)}</Text>
            </View>
          )}
          {props.vatAmount === null && (
            <View style={styles.summaryRow}>
              <Text>НДС:</Text>
              <Text>Без НДС</Text>
            </View>
          )}
          <View style={styles.summaryTotal}>
            <Text>Итого к оплате:</Text>
            <Text>{formatRub(props.total)}</Text>
          </View>
        </View>

        {props.paymentTerms && (
          <Text style={styles.footer}>
            Условия оплаты:{" "}
            {props.paymentTerms === "prepay"
              ? "предоплата"
              : `отсрочка ${props.paymentTerms.replace("net", "")} дней`}
          </Text>
        )}

        <View style={styles.signLine}>
          <View style={styles.signBox}>
            <View style={styles.signUnderline} />
            <Text style={styles.signLabel}>Руководитель</Text>
          </View>
          <View style={styles.signBox}>
            <View style={styles.signUnderline} />
            <Text style={styles.signLabel}>Главный бухгалтер</Text>
          </View>
          {props.stampUrl && (
            /* eslint-disable-next-line jsx-a11y/alt-text */
            <Image src={props.stampUrl} style={styles.stamp} />
          )}
        </View>
      </Page>
    </Document>
  )
}
