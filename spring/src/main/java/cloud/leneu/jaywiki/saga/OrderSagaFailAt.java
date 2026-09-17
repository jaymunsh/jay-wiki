package cloud.leneu.jaywiki.saga;

public enum OrderSagaFailAt {
    NONE,
    INVENTORY_RESERVE,
    PAYMENT_AUTHORIZE,
    SHIPPING_REQUEST
}
