import Image from 'next/image';

function OrderPaymentPage() {
    const paymentQrImageUrl = "/picture.svg"

    return (
        <div className="flex flex-col justify-center items-center py-10 px-6 gap-y-6">
            <div className="flex flex-col items-center gap-y-4">
                <Image
                    src={paymentQrImageUrl}
                    alt="Payment QR picture"
                    width={300}
                    height={300}
                />

                <p className="text-center text-secondary">To order the menus, please scan this QR code for payment</p>
            </div>

            <div>
                <h2 className="text-2xl font-semibold">Upload the payment evidence here</h2>

                {/* <Input
                    type="file"
                    id="paymentSlipImg"
                    accept="image/*,.svg,.svg+xml,.jpg,.png"
                    multiple={false}
                /> */}
            </div>
        </div>
    )
}

export default OrderPaymentPage