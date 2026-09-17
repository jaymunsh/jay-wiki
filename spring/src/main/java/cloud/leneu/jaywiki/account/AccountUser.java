package cloud.leneu.jaywiki.account;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.OffsetDateTime;

/**
 * 계정 = public.tb_user 테이블 (V3).
 * local(아이디/비번) 만 쓴다. 구글 로그인은 2026-08-06 에 제거했고 email·subject 컬럼도 V17 에서 드롭했다.
 */
@Entity
@Table(schema = "public", name = "tb_user")
@Getter
@Setter
public class AccountUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String username;    // 로그인 아이디
    private String password;    // BCrypt 해시
    private String nickname;
    private String role;        // ADMIN / USER
    private String provider;    // local
    /**
     * 가입한 사람이 애초에 어디서 들어왔는지. 분류된 소스 이름 하나뿐이다(V33).
     * 이 기능이 생기기 전에 가입한 계정은 null 이고 화면에서 unknown 으로 묶인다.
     */
    private String source;
    private OffsetDateTime createdAt;
}
