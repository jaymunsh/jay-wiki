package cloud.leneu.jaywiki.domainlab;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.io.InputStream;
import java.nio.file.Files;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;

@RestController
@RequestMapping("/api/domain-scenarios/spreadsheet-operations")
@RequiredArgsConstructor
public class SpreadsheetExportController {
    private static final MediaType XLSX = MediaType.parseMediaType(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    private static final DateTimeFormatter FILE_TIMESTAMP = DateTimeFormatter.ofPattern("yyyyMMdd-HHmm");

    private final SpreadsheetExportService service;

    @PostMapping("/exports")
    public ResponseEntity<StreamingResponseBody> export() {
        SpreadsheetExportService.ExportFile file = service.exportPosts();
        String filename = "jaywiki-posts-100k-" + FILE_TIMESTAMP.format(LocalDateTime.now()) + ".xlsx";
        StreamingResponseBody body = output -> {
            try (InputStream input = Files.newInputStream(file.path())) {
                input.transferTo(output);
            } finally {
                SpreadsheetExportService.deleteQuietly(file.path());
            }
        };
        return ResponseEntity.ok()
                .contentType(XLSX)
                .contentLength(file.bytes())
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .header("X-Export-Rows", String.valueOf(file.rows()))
                .header("X-Export-Duration-Ms", String.valueOf(file.durationMs()))
                .header("X-Export-Bytes", String.valueOf(file.bytes()))
                .header("X-Content-Type-Options", "nosniff")
                .body(body);
    }

    @ExceptionHandler(SpreadsheetExportService.ExportInProgressException.class)
    public ResponseEntity<Map<String, Object>> exportInProgress() {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .body(Map.of("status", 429, "detail", "다른 10만 건 Excel 생성이 진행 중입니다."));
    }
}
