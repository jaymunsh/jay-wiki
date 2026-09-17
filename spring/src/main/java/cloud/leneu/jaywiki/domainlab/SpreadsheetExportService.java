package cloud.leneu.jaywiki.domainlab;

import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.streaming.SXSSFWorkbook;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.BufferedOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.PreparedStatement;
import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

@Service
@RequiredArgsConstructor
public class SpreadsheetExportService {
    static final int EXPORT_LIMIT = 100_000;
    private static final int FETCH_SIZE = 2_000;
    private static final int ROW_WINDOW = 500;
    private static final Semaphore EXPORT_SLOT = new Semaphore(1);
    private static final DateTimeFormatter TIMESTAMP = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    private final JdbcTemplate jdbcTemplate;

    @Transactional(readOnly = true)
    public ExportFile exportPosts() {
        boolean acquired;
        try {
            acquired = EXPORT_SLOT.tryAcquire(1, TimeUnit.SECONDS);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("spreadsheet export interrupted", exception);
        }
        if (!acquired) {
            throw new ExportInProgressException();
        }

        Path path = null;
        long startedAt = System.nanoTime();
        try {
            path = Files.createTempFile("jaywiki-posts-", ".xlsx");
            int rows = writeWorkbook(path);
            long durationMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedAt);
            return new ExportFile(path, rows, durationMs, Files.size(path));
        } catch (IOException | RuntimeException exception) {
            deleteQuietly(path);
            throw new IllegalStateException("failed to create spreadsheet export", exception);
        } finally {
            EXPORT_SLOT.release();
        }
    }

    private int writeWorkbook(Path path) throws IOException {
        try (SXSSFWorkbook workbook = new SXSSFWorkbook(ROW_WINDOW);
             OutputStream output = new BufferedOutputStream(Files.newOutputStream(path))) {
            workbook.setCompressTempFiles(true);
            Sheet sheet = workbook.createSheet("게시글 10만 건");
            CellStyle dateStyle = workbook.createCellStyle();
            dateStyle.setDataFormat(workbook.getCreationHelper().createDataFormat().getFormat("yyyy-mm-dd hh:mm"));
            writeHeader(sheet);

            AtomicInteger rowIndex = new AtomicInteger(1);
            jdbcTemplate.query(connection -> {
                PreparedStatement statement = connection.prepareStatement("""
                        select id, title, author_type, author_name, views, comment_count, created_at
                        from public.tb_post
                        order by id asc
                        limit ?
                        """);
                statement.setInt(1, EXPORT_LIMIT);
                statement.setFetchSize(FETCH_SIZE);
                return statement;
            }, resultSet -> {
                Row row = sheet.createRow(rowIndex.getAndIncrement());
                row.createCell(0).setCellValue(resultSet.getLong("id"));
                row.createCell(1).setCellValue(resultSet.getString("title"));
                row.createCell(2).setCellValue(resultSet.getString("author_type"));
                row.createCell(3).setCellValue(resultSet.getString("author_name"));
                row.createCell(4).setCellValue(resultSet.getInt("views"));
                row.createCell(5).setCellValue(resultSet.getInt("comment_count"));
                Timestamp createdAt = resultSet.getTimestamp("created_at");
                if (createdAt != null) {
                    row.createCell(6).setCellValue(createdAt.toLocalDateTime());
                    row.getCell(6).setCellStyle(dateStyle);
                }
            });

            sheet.createFreezePane(0, 1);
            sheet.setAutoFilter(new org.apache.poi.ss.util.CellRangeAddress(0, 0, 0, 6));
            int[] widths = {14, 34, 16, 18, 12, 12, 20};
            for (int index = 0; index < widths.length; index++) {
                sheet.setColumnWidth(index, widths[index] * 256);
            }
            workbook.getXSSFWorkbook().getProperties().getCoreProperties().setTitle("jay-wiki 게시글 10만 건 export");
            workbook.getXSSFWorkbook().getProperties().getCoreProperties().setDescription(
                    "Generated at " + TIMESTAMP.format(OffsetDateTime.now()) + "; schema version 1");
            workbook.write(output);
            return rowIndex.get() - 1;
        }
    }

    private void writeHeader(Sheet sheet) {
        Row header = sheet.createRow(0);
        String[] columns = {"게시글 ID", "제목", "작성자 유형", "작성자", "조회수", "댓글 수", "작성 시각"};
        for (int index = 0; index < columns.length; index++) {
            header.createCell(index).setCellValue(columns[index]);
        }
    }

    static void deleteQuietly(Path path) {
        if (path == null) return;
        try {
            Files.deleteIfExists(path);
        } catch (IOException ignored) {
            // The OS temp directory is still bounded by its normal cleanup policy.
        }
    }

    public record ExportFile(Path path, int rows, long durationMs, long bytes) {
    }

    public static final class ExportInProgressException extends RuntimeException {
        public ExportInProgressException() {
            super("another spreadsheet export is already running");
        }
    }
}
