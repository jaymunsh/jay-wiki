package cloud.leneu.jaywiki.account;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;

public interface AccountUserRepository extends JpaRepository<AccountUser, Long> {
    Optional<AccountUser> findByUsername(String username);

    /** 유입 소스별 가입 수. source 가 null 인 계정은 이 기능이 생기기 전 것이라 unknown 으로 묶인다. */
    interface SignupSourceCount {
        String getSource();

        long getTotal();
    }

    @Query("""
            select coalesce(u.source, 'unknown') as source, count(u) as total
            from AccountUser u
            where u.createdAt >= :from
            group by coalesce(u.source, 'unknown')
            order by count(u) desc
            """)
    List<SignupSourceCount> countBySource(@Param("from") OffsetDateTime from);
}
