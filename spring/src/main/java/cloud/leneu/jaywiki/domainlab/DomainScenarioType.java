package cloud.leneu.jaywiki.domainlab;

import java.util.Arrays;

public enum DomainScenarioType {
    GIFT_CARD("gift-card"),
    PARTNER_API("partner-api"),
    ORDER("order-confirmation"),
    TRAFFIC_BURST("traffic-burst"),
    COUPON_RACE("coupon-race"),
    SETTLEMENT_BATCH("settlement-batch"),
    CONNECTION_POOL("connection-pool"),
    N_PLUS_ONE("n-plus-one"),
    DATA_CORRECTION("data-correction"),
    PRIVACY_LIFECYCLE("privacy-lifecycle"),
    SPREADSHEET_OPERATIONS("spreadsheet-operations"),
    BUSINESS_METRICS("business-metrics"),
    NOTIFICATION_DELIVERY("notification-delivery"),
    MAINTENANCE_MODE("maintenance-mode"),
    IMAGE_UPLOAD_PIPELINE("image-upload-pipeline");

    private final String slug;

    DomainScenarioType(String slug) {
        this.slug = slug;
    }

    public String slug() {
        return slug;
    }

    public static DomainScenarioType fromSlug(String slug) {
        return Arrays.stream(values())
                .filter(value -> value.slug.equals(slug))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("unsupported domain scenario: " + slug));
    }
}
