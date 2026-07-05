package ch.homely;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cache.annotation.EnableCaching;

@SpringBootApplication
@EnableCaching
public class HomelyApplication {

    public static void main(String[] args) {
        SpringApplication.run(HomelyApplication.class, args);
    }
}
