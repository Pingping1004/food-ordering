type Props = {
    isIOS: boolean;
    isLargeTextMode: boolean;
};

export default function InstallGuide({ isIOS, isLargeTextMode }: Props) {
    const textSize = isLargeTextMode ? "text-lg" : "text-sm";

    return (
        <div className={`mt-2 space-y-3 ${textSize}`}>
            <p className="font-medium">
                ⚠️ จำเป็นต้องติดตั้งแอปก่อน ถึงจะมีเสียงแจ้งเตือนตอนมีออเดอร์เข้า
                ⚠️ อย่าปิดแอป ถ้าปิดแล้วต้องเข้าสู่ระบบใหม่
            </p>
shouldShowIosOnboarding ?
            {isIOS ? (
                <div className="space-y-1">
                    <p className="font-semibold">📱 iPhone / iPad</p>
                    <ol className="list-decimal ml-5 space-y-1">
                        <li>เปิดเว็บนี้ด้วย <b>Safari</b></li>
                        <li>กดปุ่ม <b>แชร์</b></li>
                        <li>เลือก <b>“เพิ่มไปยังหน้าจอโฮม”</b></li>
                        <li>กด <b>เพิ่ม</b></li>
                        <li>กลับไปเปิดแอปจากหน้าจอโฮม</li>
                        <li>กด <b>เปิดการแจ้งเตือน</b></li>
                    </ol>

                    <p className="text-danger-main text-xs">
                        หากเปิดจาก LINE ให้กด “เปิดใน Safari/Google Chrome” ก่อน
                    </p>
                </div>

            ) : (
                <div className="space-y-1">
                    <p className="font-semibold">🤖 Android</p>
                    <ol className="list-decimal ml-5 space-y-1">
                        <li>กดปุ่ม <b>⋮ มุมขวาบน</b></li>
                        <li>เลือก <b>“ติดตั้งแอป”</b> หรือ <b>“เพิ่มไปยังหน้าจอโฮม”</b></li>
                        <li>กด <b>ติดตั้ง</b></li>
                        <li>กลับไปเปิดแอปจากหน้าจอโฮม</li>
                        <li>กด <b>เปิดการแจ้งเตือน</b></li>
                    </ol>

                    <p className="text-danger-main text-xs">
                        หากเปิดจาก LINE ให้กด “เปิดใน Chrome” ก่อน
                    </p>
                </div>
            )}
        </div>
    );
}