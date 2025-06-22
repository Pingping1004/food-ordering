import { OmiseBankType, OMISE_BANK_TYPE_VALUES } from "@/common/bank-type.enum";
import { z } from "zod";

export const createOrderMenusSchema = z.object({
    orderMenuId: z.string().uuid('Invalid menu item ID format'),
    quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
    menuName: z.string(),
    unitPrice: z.coerce.number().int("unit price must be an integer"),
    details: z.string().optional(),
    menuImg: z.string().url('Invalid menu image URL format').optional(),
});

export const MobileBankingPaymentDetailSchema = z.object({
    amount: z.coerce.number().int().min(1),
    bankType: z.enum(OMISE_BANK_TYPE_VALUES as [string, ...string[]], {
        errorMap: (issue, ctx) => {
            if (issue.code === z.ZodIssueCode.invalid_enum_value) {
                return { message: 'Invalid bank type selected'};
            }
            return { message: ctx.defaultError };
        }
    }),
})

export const createOrderSchema = z.object({
    restaurantId: z.string().uuid('Invalid restaurant ID'),
    orderAt: z.coerce.date(),
    deliverAt: z.coerce.date(),
    isPaid: z.literal("unpaid", {
      errorMap: (issue, ctx) => {
        if (issue.code === z.ZodIssueCode.invalid_literal) {
          return { message: 'New orders with online payment are initially "unpaid". Payment confirmation is async.' };
        }
        return { message: ctx.defaultError };
      }
  }),
    orderMenus: z.array(createOrderMenusSchema)
        .min(1, 'Order must contain at least one menu item')
        .max(10, 'Order cannot contain more than 10 items'),
    paymentDetails: MobileBankingPaymentDetailSchema,
});

export type CrateOrderDto = z.infer<typeof createOrderSchema>