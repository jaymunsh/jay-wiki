package cloud.leneu.jaywiki.wiki;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * 1차 탭(카테고리) = public.tb_tab 테이블 (V2).
 * 사이트에서 추가/수정/삭제/순서변경(드래그) 가능 → 코드 수정 없이 탭 관리.
 */
@Entity
@Table(schema = "public", name = "tb_tab")
@Getter
@Setter
public class WikiTab {

    @Id
    private String tabId;          // start, data ...

    private String title;          // "0. 시작하기"
    private int sortOrder = 0;     // 탭 정렬
    private OffsetDateTime createdAt;
}
