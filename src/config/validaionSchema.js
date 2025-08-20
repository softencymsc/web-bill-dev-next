// validationSchema.js
import * as yup from "yup";

export const productSchema = yup
  .object({
    PRODCODE: yup.string().required(),
    DESCRIPT: yup.string().required(),
    SERVICE: yup.string().required("Please select Yes or No"),
    UOM_PURCH: yup.string().required("required").max(5),
    UOM_STK: yup.string().required("required").max(5),
    UOM_SALE: yup.string().required("required").max(5),
    HSNCODE: yup
      .number()
      .nullable()
      .moreThan(0, "hsn code cant be negative")
      .transform((_, val) => (val !== "" ? Number(val) : null)),
    IGST: yup.number(),
    RATE: yup.number(),
    BUY_RATE: yup.number().required(),
    MRP_RATE: yup.number().required(),
    DISCPER: yup.number(),
    GroupDesc: yup.string().required(),
    SGroupDesc: yup.string().required("required"),
    OPENING_Q: yup.number(),
    OPENING_V: yup.number(),
  })
  .required();
